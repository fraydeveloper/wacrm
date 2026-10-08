'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Contact, MessageTemplate } from '@/types';
import { normalizePhone } from '@/lib/whatsapp/phone-utils';
import { chunk, fetchAllPages, IN_CHUNK } from '@/lib/supabase/paginate';

export type CustomFieldOperator = 'is' | 'is_not' | 'contains';

export interface CustomFieldFilter {
  fieldId: string;
  operator: CustomFieldOperator;
  value: string;
}

export interface AudienceConfig {
  type: 'all' | 'tags' | 'custom_field' | 'csv';
  tagIds?: string[];
  customField?: CustomFieldFilter;
  csvContacts?: { phone: string; name?: string }[];
  /** Contacts carrying any of these tags are subtracted from the result. */
  excludeTagIds?: string[];
}

/**
 * Variable mapping — each template placeholder (by key, usually "1",
 * "2", …) is resolved at send time. `field` maps to a built-in contact
 * field (name/phone/email/company); `custom_field` maps to a
 * contact_custom_values.value row keyed by the custom_fields.id stored
 * in `value`.
 */
export type VariableMapping =
  | { type: 'static'; value: string }
  | { type: 'field'; value: string }
  | { type: 'custom_field'; value: string };

interface BroadcastPayload {
  name: string;
  template: MessageTemplate;
  audience: AudienceConfig;
  variables: Record<string, VariableMapping>;
  /**
   * Media URL for an IMAGE/VIDEO/DOCUMENT header. Required at send
   * time for media-header templates — Meta rejects the send without
   * it. Passed through as `messageParams.headerMediaUrl`; the builder
   * falls back to the template's stored URL only when this is empty.
   */
  headerMediaUrl?: string;
}

interface UseBroadcastSendingReturn {
  createAndSendBroadcast: (payload: BroadcastPayload) => Promise<string>;
  isProcessing: boolean;
  progress: number;
}

/**
 * Meta rate-limit buffer. 10 per batch + 1 s pause matches the spec
 * and keeps us comfortably under Meta's per-phone-number messaging
 * rate so a large broadcast never trips the upstream limiter.
 */
const SEND_BATCH_SIZE = 10;
const SEND_BATCH_DELAY_MS = 1000;

/** `broadcast_recipients` inserts are independent of the send rate. */
const INSERT_BATCH_SIZE = 200;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Max attempts for one send batch when the API answers 429. */
const MAX_RATE_LIMIT_RETRIES = 5;

interface BroadcastApiResult {
  phone: string;
  status: 'sent' | 'failed';
  whatsapp_message_id?: string;
  error?: string;
}

/** contactId → (customFieldId → value). */
type CustomValueIndex = Map<string, Map<string, string>>;

/**
 * Per-contact resolution of custom-field placeholders. Static and
 * built-in-field mappings resolve synchronously; custom fields read
 * from a pre-built index to avoid N+1 queries during the send loop.
 */
export function resolveVariables(
  variables: Record<string, VariableMapping>,
  contact: Contact,
  customValues?: Map<string, string>,
): string[] {
  // Keys are typically "1","2",... — numeric-aware sort keeps
  // {{1}} before {{10}}.
  const keys = Object.keys(variables).sort((a, b) => {
    const an = Number(a);
    const bn = Number(b);
    if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
    return a.localeCompare(b);
  });

  return keys.map((key) => {
    const v = variables[key];
    if (v.type === 'static') return v.value;

    if (v.type === 'field') {
      const fieldMap: Record<string, string | undefined> = {
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
        company: contact.company,
      };
      return fieldMap[v.value] ?? '';
    }

    // custom_field
    return customValues?.get(v.value) ?? '';
  });
}

/**
 * Bulk-fetch contact_custom_values for a set of contacts. Returns an
 * index keyed by contact_id → field_id → value.
 */
async function fetchCustomValueIndex(
  supabase: ReturnType<typeof createClient>,
  contactIds: string[],
): Promise<CustomValueIndex> {
  const index: CustomValueIndex = new Map();
  if (contactIds.length === 0) return index;

  // Supabase PostgREST caps the .in(...) IN-clause roughly at 1000
  // values. Page through to stay safe.
  const PAGE = 500;
  for (let i = 0; i < contactIds.length; i += PAGE) {
    const slice = contactIds.slice(i, i + PAGE);
    const { data } = await supabase
      .from('contact_custom_values')
      .select('contact_id, custom_field_id, value')
      .in('contact_id', slice);

    for (const row of data ?? []) {
      const bucket = index.get(row.contact_id) ?? new Map<string, string>();
      bucket.set(row.custom_field_id, row.value ?? '');
      index.set(row.contact_id, bucket);
    }
  }
  return index;
}

export function useBroadcastSending(): UseBroadcastSendingReturn {
  const { accountId } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  async function resolveAudience(audience: AudienceConfig): Promise<Contact[]> {
    const supabase = createClient();
    if (!accountId) {
      throw new Error('Tu perfil no está vinculado a una cuenta.');
    }

    let contacts: Contact[] = [];

    if (audience.type === 'all') {
      contacts = await fetchAllPages<Contact>((from, to) =>
        supabase
          .from('contacts')
          .select('*')
          .eq('account_id', accountId)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to),
      ).catch((e: Error) => {
        throw new Error(`No se pudieron cargar los contactos: ${e.message}`);
      });
    } else if (
      audience.type === 'tags' &&
      audience.tagIds &&
      audience.tagIds.length > 0
    ) {
      const tagIds = audience.tagIds;
      const contactTags = await fetchAllPages<{ contact_id: string }>(
        (from, to) =>
          supabase
            .from('contact_tags')
            .select('contact_id')
            .in('tag_id', tagIds)
            .order('contact_id', { ascending: true })
            .range(from, to),
      ).catch((e: Error) => {
        throw new Error(`No se pudieron cargar las etiquetas: ${e.message}`);
      });
      const uniqueContactIds = [
        ...new Set(contactTags.map((ct) => ct.contact_id)),
      ];
      contacts = await fetchContactsByIds(supabase, uniqueContactIds);
    } else if (audience.type === 'custom_field' && audience.customField) {
      contacts = await resolveCustomFieldAudience(supabase, audience.customField);
    } else if (audience.type === 'csv' && audience.csvContacts) {
      contacts = await upsertCsvContacts(supabase, audience.csvContacts);
    }

    // Apply exclude tags (works across all contact-derived audience
    // types, CSV included — those rows are real contacts by now).
    if (audience.excludeTagIds && audience.excludeTagIds.length > 0) {
      const excludeTagIds = audience.excludeTagIds;
      const excludeRows = await fetchAllPages<{ contact_id: string }>(
        (from, to) =>
          supabase
            .from('contact_tags')
            .select('contact_id')
            .in('tag_id', excludeTagIds)
            .order('contact_id', { ascending: true })
            .range(from, to),
      );
      const excludedIds = new Set(excludeRows.map((r) => r.contact_id));
      contacts = contacts.filter((c) => !excludedIds.has(c.id));
    }

    return contacts;
  }

  async function fetchContactsByIds(
    supabase: ReturnType<typeof createClient>,
    ids: string[],
  ): Promise<Contact[]> {
    const out: Contact[] = [];
    for (const slice of chunk(ids, IN_CHUNK)) {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .in('id', slice);
      if (error)
        throw new Error(`No se pudieron cargar los contactos: ${error.message}`);
      out.push(...((data ?? []) as Contact[]));
    }
    return out;
  }

  /**
   * CSV uploads arrive as raw phone/name pairs, not DB rows. Before we
   * can insert broadcast_recipients (whose contact_id FKs contacts.id),
   * we need real contacts.id UUIDs. So: look up each CSV phone in the
   * caller's contacts table; insert any that don't exist; return the
   * resolved set.
   *
   * Pre-existing implementation synthesized `csv-N` strings as
   * contact_id, which failed the UUID cast on insert — every CSV
   * broadcast silently created zero recipients.
   */
  async function upsertCsvContacts(
    supabase: ReturnType<typeof createClient>,
    csvRows: { phone: string; name?: string }[],
  ): Promise<Contact[]> {
    if (csvRows.length === 0) return [];

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      throw new Error('No has iniciado sesión.');
    }
    if (!accountId) {
      throw new Error('Tu perfil no está vinculado a una cuenta.');
    }

    // De-duplicate by the canonical digits-only key — the same key the
    // DB enforces unique per account (contacts.phone_normalized, 022).
    // Keying by the raw string let "+51 987…" and "51987…" through as
    // two rows, and the second INSERT then failed the unique index and
    // aborted the whole campaign.
    const uniqueByKey = new Map<string, { phone: string; name?: string }>();
    for (const row of csvRows) {
      const key = normalizePhone(row.phone ?? '');
      if (key && !uniqueByKey.has(key)) uniqueByKey.set(key, row);
    }
    const keys = [...uniqueByKey.keys()];

    // Look up existing contacts in this ACCOUNT (not just this user —
    // a teammate may have created them) by normalized phone.
    const byKey = new Map<string, Contact>();
    for (const slice of chunk(keys, IN_CHUNK)) {
      const { data: existing, error: lookupErr } = await supabase
        .from('contacts')
        .select('*')
        .eq('account_id', accountId)
        .in('phone_normalized', slice);
      if (lookupErr) {
        throw new Error(
          `No se pudieron buscar los contactos del CSV: ${lookupErr.message}`,
        );
      }
      for (const c of (existing ?? []) as Contact[]) {
        const k = normalizePhone(c.phone ?? '');
        if (k) byKey.set(k, c);
      }
    }

    const missing = keys
      .filter((k) => !byKey.has(k))
      .map((k) => {
        const src = uniqueByKey.get(k)!;
        return {
          user_id: user.id,
          account_id: accountId,
          phone: src.phone.trim(),
          name: src.name?.trim() || null,
        };
      });

    const INSERT_CHUNK = 200;
    for (const rows of chunk(missing, INSERT_CHUNK)) {
      const { data: inserted, error: insertErr } = await supabase
        .from('contacts')
        .insert(rows)
        .select();
      if (!insertErr) {
        for (const c of (inserted ?? []) as Contact[]) {
          byKey.set(normalizePhone(c.phone ?? ''), c);
        }
        continue;
      }
      // A race (or a teammate importing at the same time) can make one
      // row collide with the unique index and sink the batch. Fall back
      // to row-by-row so only the colliding numbers are re-read.
      for (const row of rows) {
        const { data: one, error: oneErr } = await supabase
          .from('contacts')
          .insert(row)
          .select()
          .single();
        if (!oneErr && one) {
          byKey.set(normalizePhone((one as Contact).phone ?? ''), one as Contact);
          continue;
        }
        const k = normalizePhone(row.phone);
        const { data: again } = await supabase
          .from('contacts')
          .select('*')
          .eq('account_id', accountId)
          .eq('phone_normalized', k)
          .maybeSingle();
        if (again) byKey.set(k, again as Contact);
      }
    }

    // Preserve input order so analytics roughly matches the CSV order.
    return keys
      .map((k) => byKey.get(k))
      .filter((c): c is Contact => Boolean(c));
  }

  async function resolveCustomFieldAudience(
    supabase: ReturnType<typeof createClient>,
    filter: CustomFieldFilter,
  ): Promise<Contact[]> {
    const { fieldId, operator, value } = filter;

    // Build the WHERE clause for the operator. PostgREST supports
    // eq/neq/ilike via the query builder — use ilike with wildcards
    // for "contains" so the match is case-insensitive.
    // Fresh builder per page — PostgREST builders mutate in place.
    const buildQuery = () => {
      let query = supabase
        .from('contact_custom_values')
        .select('contact_id')
        .eq('custom_field_id', fieldId);
      if (operator === 'is') query = query.eq('value', value);
      else if (operator === 'is_not') query = query.neq('value', value);
      else if (operator === 'contains') query = query.ilike('value', `%${value}%`);
      return query;
    };

    const matches = await fetchAllPages<{ contact_id: string }>((from, to) =>
      buildQuery().order('contact_id', { ascending: true }).range(from, to),
    ).catch((e: Error) => {
      throw new Error(`Falló el filtro por campo personalizado: ${e.message}`);
    });

    const contactIds = [...new Set(matches.map((m) => m.contact_id))];
    if (contactIds.length === 0) return [];

    return fetchContactsByIds(supabase, contactIds);
  }

  async function createAndSendBroadcast(payload: BroadcastPayload): Promise<string> {
    setIsProcessing(true);
    setProgress(0);

    const supabase = createClient();

    try {
      // ── Step 0: Resolve current user ──────────────────────────────
      // broadcasts.user_id is NOT NULL + guarded by RLS
      // (auth.uid() = user_id). Without this, the INSERT below was
      // silently failing with 23502 / 42501 — the wizard would
      // no-op with no feedback.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        throw new Error('No has iniciado sesión.');
      }
      if (!accountId) {
        throw new Error('Tu perfil no está vinculado a una cuenta.');
      }

      // ── Step 1: Resolve audience contacts ─────────────────────────
      setProgress(5);
      const contacts = await resolveAudience(payload.audience);

      if (contacts.length === 0) {
        throw new Error('No se encontraron contactos para esta audiencia.');
      }

      // ── Step 2: Create broadcast row ──────────────────────────────
      setProgress(10);
      const { data: broadcast, error: broadcastError } = await supabase
        .from('broadcasts')
        .insert({
          user_id: user.id,
          account_id: accountId,
          name: payload.name,
          template_name: payload.template.name,
          template_language: payload.template.language ?? 'en_US',
          template_variables: payload.variables,
          audience_filter: {
            type: payload.audience.type,
            tagIds: payload.audience.tagIds,
            customField: payload.audience.customField,
            excludeTagIds: payload.audience.excludeTagIds,
          },
          status: 'sending',
          total_recipients: contacts.length,
          sent_count: 0,
          delivered_count: 0,
          read_count: 0,
          replied_count: 0,
          failed_count: 0,
        })
        .select()
        .single();

      if (broadcastError || !broadcast) {
        throw new Error(
          `No se pudo crear la difusión: ${broadcastError?.message ?? 'error desconocido'}`,
        );
      }

      // ── Step 3: Insert recipient rows ─────────────────────────────
      setProgress(20);
      const recipientRows = contacts.map((contact) => ({
        broadcast_id: broadcast.id,
        contact_id: contact.id,
        status: 'pending' as const,
      }));

      for (let i = 0; i < recipientRows.length; i += INSERT_BATCH_SIZE) {
        const batch = recipientRows.slice(i, i + INSERT_BATCH_SIZE);
        const { error: recipientError } = await supabase
          .from('broadcast_recipients')
          .insert(batch);
        if (recipientError) {
          // Previous impl logged and marched on — the broadcast then ran
          // with an incomplete recipient set, so webhook status updates
          // couldn't find some rows and the aggregate counts drifted.
          // Flip the broadcast to failed so the user sees the problem
          // immediately, then throw to abort the send loop.
          await supabase
            .from('broadcasts')
            .update({
              status: 'failed',
              failed_count: contacts.length,
            })
            .eq('id', broadcast.id);
          throw new Error(
            `No se pudo registrar el lote de destinatarios ${i / INSERT_BATCH_SIZE + 1}: ${recipientError.message}`,
          );
        }
      }

      // ── Step 4: Fetch recipients (joined contact) + preload custom values
      setProgress(30);
      // Paginated: a single select stops at 1 000 rows, which left every
      // recipient past that point stuck in "pending" forever.
      type RecipientWithContact = {
        id: string;
        contact: Contact | null;
      };
      const recipients = await fetchAllPages<RecipientWithContact>(
        (from, to) =>
          supabase
            .from('broadcast_recipients')
            .select('*, contact:contacts(*)')
            .eq('broadcast_id', broadcast.id)
            .order('id', { ascending: true })
            .range(from, to),
      ).catch(() => {
        throw new Error('No se pudieron cargar los destinatarios de la difusión');
      });

      // One bulk fetch of custom values for every contact in this
      // broadcast, avoiding N+1 during the send loop.
      const contactIds = recipients
        .map((r) => r.contact?.id)
        .filter((id): id is string => Boolean(id));
      const customValueIndex = await fetchCustomValueIndex(
        supabase,
        contactIds,
      );

      let failedCount = 0;
      const totalRecipients = recipients.length;

      // Media-header templates (image/video/document) require a media
      // URL on every send. Collected in the personalize step and applied
      // to all recipients; falls back to the template's stored URL on the
      // server when omitted.
      const headerType = payload.template.header_type;
      const isMediaHeader =
        headerType === 'image' ||
        headerType === 'video' ||
        headerType === 'document';
      const headerMediaUrl = payload.headerMediaUrl?.trim();
      const messageParams =
        isMediaHeader && headerMediaUrl ? { headerMediaUrl } : undefined;

      for (let i = 0; i < recipients.length; i += SEND_BATCH_SIZE) {
        const batch = recipients.slice(i, i + SEND_BATCH_SIZE);

        const apiRecipients = batch
          .filter((r) => r.contact?.phone)
          .map((r) => ({
            phone: r.contact!.phone as string,
            params: r.contact
              ? resolveVariables(
                  payload.variables,
                  r.contact,
                  customValueIndex.get(r.contact.id),
                )
              : [],
            ...(messageParams ? { messageParams } : {}),
          }));

        if (apiRecipients.length === 0) continue;

        try {
          const body = JSON.stringify({
            recipients: apiRecipients,
            template_name: payload.template.name,
            template_language: payload.template.language ?? 'en_US',
          });

          // Back off and retry on 429 instead of failing the batch —
          // a long campaign must survive brief rate-limit windows.
          let res: Response | null = null;
          for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
            res = await fetch('/api/whatsapp/broadcast', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body,
            });
            if (res.status !== 429 || attempt === MAX_RATE_LIMIT_RETRIES) break;
            const retryAfter = Number(res.headers.get('Retry-After'));
            await sleep(
              (Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 5) *
                1000,
            );
          }

          const data = await res!.json().catch(() => ({}));

          if (!res!.ok) {
            throw new Error(data.error || 'Falló la solicitud de envío de la difusión');
          }

          const resultsByPhone = new Map<string, BroadcastApiResult>();
          for (const r of (data.results ?? []) as BroadcastApiResult[]) {
            resultsByPhone.set(r.phone, r);
          }

          for (const recipient of batch) {
            const phone = recipient.contact?.phone;
            const result = phone ? resultsByPhone.get(phone) : undefined;

            if (!result) {
              failedCount++;
              await supabase
                .from('broadcast_recipients')
                .update({
                  status: 'failed',
                  error_message: 'El contacto no tiene número de teléfono',
                })
                .eq('id', recipient.id);
              continue;
            }

            if (result.status === 'sent') {
              await supabase
                .from('broadcast_recipients')
                .update({
                  status: 'sent',
                  sent_at: new Date().toISOString(),
                  whatsapp_message_id: result.whatsapp_message_id ?? null,
                  error_message: null,
                })
                .eq('id', recipient.id);
            } else {
              failedCount++;
              await supabase
                .from('broadcast_recipients')
                .update({
                  status: 'failed',
                  error_message: result.error ?? 'Error desconocido',
                })
                .eq('id', recipient.id);
            }
          }
        } catch (err) {
          for (const recipient of batch) {
            failedCount++;
            await supabase
              .from('broadcast_recipients')
              .update({
                status: 'failed',
                error_message: err instanceof Error ? err.message : 'Error desconocido',
              })
              .eq('id', recipient.id);
          }
        }

        const progressPct =
          30 + Math.round(((i + batch.length) / totalRecipients) * 60);
        setProgress(progressPct);

        if (i + SEND_BATCH_SIZE < recipients.length) {
          await sleep(SEND_BATCH_DELAY_MS);
        }
      }

      // ── Step 5: Finalize status ───────────────────────────────────
      // Aggregate counts are maintained by the DB trigger (migration
      // 003); we only flip the final status here.
      setProgress(95);
      const finalStatus = failedCount === totalRecipients ? 'failed' : 'sent';
      await supabase
        .from('broadcasts')
        .update({ status: finalStatus })
        .eq('id', broadcast.id);

      setProgress(100);
      return broadcast.id;
    } finally {
      setIsProcessing(false);
    }
  }

  return { createAndSendBroadcast, isProcessing, progress };
}
