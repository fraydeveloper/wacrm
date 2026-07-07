import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from './admin-client'
import { findExistingContact, isUniqueViolation } from '@/lib/contacts/dedupe'
import { runAutomationsForTrigger } from '@/lib/automations/engine'
import { dispatchInboundToFlows } from '@/lib/flows/engine'
import { dispatchInboundToAiReply } from '@/lib/ai/auto-reply'
import { dispatchWebhookEvent } from '@/lib/webhooks/deliver'

// ============================================================
// Shared inbound-message ingestion core.
//
// Extracted from the WhatsApp webhook (src/app/api/whatsapp/webhook/
// route.ts) so a new channel's webhook doesn't have to re-implement
// find-or-create contact/conversation, message persistence, and the
// automations/flows/AI fan-out. Everything that IS channel-specific
// (parsing the provider's wire payload, reactions, delivery-status
// ladders, media download/verification) stays in each channel's own
// webhook file — this module only knows about already-parsed content.
//
// The WhatsApp webhook calls this with `identity: { kind: 'phone' }`
// and its behavior is unchanged from before the extraction. A new
// channel (Messenger now; Instagram/Telegram later) uses
// `identity: { kind: 'channel_identity' }`, which resolves/creates the
// contact via `contact_channel_identities` instead of a phone number.
// ============================================================

export type Channel = 'whatsapp' | 'messenger' | 'instagram' | 'telegram'

export type IdentityStrategy =
  | { kind: 'phone'; phone: string }
  | { kind: 'channel_identity'; channel: Exclude<Channel, 'whatsapp'>; externalId: string }

const ALLOWED_CONTENT_TYPES = new Set([
  'text', 'image', 'document', 'audio', 'video',
  'location', 'template', 'interactive',
])

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any

export interface IngestMessageInput {
  accountId: string
  /** Sender-of-record for inserts that need a NOT NULL user_id FK
   *  (contacts, conversations). Same role as `configOwnerUserId` in
   *  the WhatsApp webhook — whichever admin saved the channel's config. */
  configOwnerUserId: string
  channel: Channel
  identity: IdentityStrategy
  contactName: string
  contentType: string
  contentText: string | null
  mediaUrl?: string | null
  /** The provider's own message id (wamid, Messenger mid, etc.). */
  externalMessageId: string
  createdAt: string
  replyToInternalId?: string | null
  interactiveReplyId?: string | null
}

export interface IngestMessageResult {
  contact: Row
  contactWasCreated: boolean
  conversation: Row
  conversationWasCreated: boolean
  isFirstInboundMessage: boolean
  flowConsumed: boolean
}

interface ContactOutcome {
  contact: Row
  wasCreated: boolean
}

async function findOrCreateContactByPhone(
  db: SupabaseClient,
  accountId: string,
  configOwnerUserId: string,
  phone: string,
  name: string,
): Promise<ContactOutcome | null> {
  const existingContact = await findExistingContact(db, accountId, phone)

  if (existingContact) {
    if (name && name !== existingContact.name) {
      await db
        .from('contacts')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', existingContact.id)
    }
    return { contact: existingContact, wasCreated: false }
  }

  const { data: newContact, error: createError } = await db
    .from('contacts')
    .insert({
      account_id: accountId,
      user_id: configOwnerUserId,
      phone,
      name: name || phone,
    })
    .select()
    .single()

  if (createError) {
    if (isUniqueViolation(createError)) {
      const raced = await findExistingContact(db, accountId, phone)
      if (raced) return { contact: raced, wasCreated: false }
    }
    console.error('[ingest-core] Error creating contact by phone:', createError)
    return null
  }

  return { contact: newContact, wasCreated: true }
}

async function findOrCreateContactByChannelIdentity(
  db: SupabaseClient,
  accountId: string,
  configOwnerUserId: string,
  channel: Exclude<Channel, 'whatsapp'>,
  externalId: string,
  name: string,
): Promise<ContactOutcome | null> {
  const { data: existingIdentity, error: identityErr } = await db
    .from('contact_channel_identities')
    .select('contact_id, contacts(*)')
    .eq('account_id', accountId)
    .eq('channel', channel)
    .eq('external_id', externalId)
    .maybeSingle()

  if (identityErr) {
    console.error('[ingest-core] Error looking up channel identity:', identityErr)
    return null
  }

  if (existingIdentity?.contacts) {
    const contact = existingIdentity.contacts as Row
    if (name && name !== contact.name) {
      await db
        .from('contacts')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', contact.id)
      contact.name = name
    }
    return { contact, wasCreated: false }
  }

  // No identity row yet — create the contact (no phone; see migration
  // 031) and link it. Insert order matters: create the contact first,
  // then the identity row, so a race on the identity's UNIQUE
  // (account_id, channel, external_id) is what we detect and recover
  // from, mirroring the phone path's race handling.
  const { data: newContact, error: contactCreateError } = await db
    .from('contacts')
    .insert({
      account_id: accountId,
      user_id: configOwnerUserId,
      phone: null,
      name: name || externalId,
    })
    .select()
    .single()

  if (contactCreateError) {
    console.error('[ingest-core] Error creating channel contact:', contactCreateError)
    return null
  }

  const { error: linkError } = await db.from('contact_channel_identities').insert({
    account_id: accountId,
    channel,
    external_id: externalId,
    contact_id: newContact.id,
  })

  if (linkError) {
    if (isUniqueViolation(linkError)) {
      // Lost a race: another concurrent delivery already linked this
      // external_id to a (different) contact. Re-resolve that contact
      // and drop the one we just created — it has no other references
      // yet, so it's safe to delete.
      const { data: raced } = await db
        .from('contact_channel_identities')
        .select('contact_id, contacts(*)')
        .eq('account_id', accountId)
        .eq('channel', channel)
        .eq('external_id', externalId)
        .maybeSingle()
      await db.from('contacts').delete().eq('id', newContact.id)
      if (raced?.contacts) {
        return { contact: raced.contacts as Row, wasCreated: false }
      }
      console.error('[ingest-core] Race on channel identity but no row found on retry')
      return null
    }
    console.error('[ingest-core] Error linking channel identity:', linkError)
    return null
  }

  return { contact: newContact, wasCreated: true }
}

async function findOrCreateConversation(
  db: SupabaseClient,
  accountId: string,
  configOwnerUserId: string,
  contactId: string,
  channel: Channel,
): Promise<{ conversation: Row; created: boolean } | null> {
  const { data: existing, error: findError } = await db
    .from('conversations')
    .select('*')
    .eq('account_id', accountId)
    .eq('contact_id', contactId)
    .eq('channel', channel)
    .maybeSingle()

  if (!findError && existing) {
    return { conversation: existing, created: false }
  }

  const { data: newConv, error: createError } = await db
    .from('conversations')
    .insert({
      account_id: accountId,
      user_id: configOwnerUserId,
      contact_id: contactId,
      channel,
    })
    .select()
    .single()

  if (createError) {
    console.error('[ingest-core] Error creating conversation:', createError)
    return null
  }

  return { conversation: newConv, created: true }
}

export interface ResolvedThread {
  contact: Row
  contactWasCreated: boolean
  conversation: Row
  conversationWasCreated: boolean
}

/**
 * Resolve (or create) the contact and conversation for an inbound
 * message, dispatching `conversation.created` when a new thread was
 * just opened. Split out from message persistence because some
 * channels (WhatsApp reactions) need to short-circuit AFTER the
 * thread exists but BEFORE a message row is written.
 */
export async function resolveContactAndConversation(args: {
  accountId: string
  configOwnerUserId: string
  channel: Channel
  identity: IdentityStrategy
  contactName: string
}): Promise<ResolvedThread | null> {
  const db = supabaseAdmin()
  const { accountId, configOwnerUserId, channel, identity, contactName } = args

  const contactOutcome =
    identity.kind === 'phone'
      ? await findOrCreateContactByPhone(db, accountId, configOwnerUserId, identity.phone, contactName)
      : await findOrCreateContactByChannelIdentity(
          db,
          accountId,
          configOwnerUserId,
          identity.channel,
          identity.externalId,
          contactName,
        )
  if (!contactOutcome) return null

  const convResult = await findOrCreateConversation(
    db,
    accountId,
    configOwnerUserId,
    contactOutcome.contact.id,
    channel,
  )
  if (!convResult) return null

  if (convResult.created) {
    await dispatchWebhookEvent(db, accountId, 'conversation.created', {
      conversation_id: convResult.conversation.id,
      contact_id: contactOutcome.contact.id,
    })
  }

  return {
    contact: contactOutcome.contact,
    contactWasCreated: contactOutcome.wasCreated,
    conversation: convResult.conversation,
    conversationWasCreated: convResult.created,
  }
}

/**
 * Persist an inbound message onto an already-resolved thread and fan
 * out to flows / automations / AI auto-reply / outbound webhooks.
 *
 * Never throws — every downstream dispatch already owns its own
 * try/catch (flows, automations, AI auto-reply); this function's own
 * DB calls are guarded and return null/best-effort on failure so a
 * webhook caller can always ack 200 to the provider.
 */
export async function recordAndDispatchMessage(
  thread: ResolvedThread,
  input: Omit<IngestMessageInput, 'identity' | 'contactName'>,
): Promise<IngestMessageResult | null> {
  const db = supabaseAdmin()
  const { accountId, configOwnerUserId, channel, createdAt } = input
  const { contact: contactRecord, conversation, contactWasCreated } = thread

  const contentType = ALLOWED_CONTENT_TYPES.has(input.contentType)
    ? input.contentType
    : 'text'

  const { count: priorCustomerMsgCount } = await db
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversation.id)
    .eq('sender_type', 'customer')
  const isFirstInboundMessage = (priorCustomerMsgCount ?? 0) === 0

  const { error: msgError } = await db.from('messages').insert({
    conversation_id: conversation.id,
    channel,
    sender_type: 'customer',
    content_type: contentType,
    content_text: input.contentText,
    media_url: input.mediaUrl ?? null,
    message_id: input.externalMessageId,
    status: 'delivered',
    created_at: createdAt,
    reply_to_message_id: input.replyToInternalId ?? null,
    interactive_reply_id: input.interactiveReplyId ?? null,
  })

  if (msgError) {
    console.error('[ingest-core] Error inserting message:', msgError)
    return null
  }

  const { error: convError } = await db
    .from('conversations')
    .update({
      last_message_text: input.contentText || `[${contentType}]`,
      last_message_at: new Date().toISOString(),
      unread_count: (conversation.unread_count || 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversation.id)

  if (convError) {
    console.error('[ingest-core] Error updating conversation:', convError)
  }

  const inboundText = input.contentText ?? ''
  const flowResult = await dispatchInboundToFlows({
    accountId,
    userId: configOwnerUserId,
    contactId: contactRecord.id,
    conversationId: conversation.id,
    message: input.interactiveReplyId
      ? {
          kind: 'interactive_reply',
          reply_id: input.interactiveReplyId,
          reply_title: inboundText,
          meta_message_id: input.externalMessageId,
        }
      : {
          kind: 'text',
          text: inboundText,
          meta_message_id: input.externalMessageId,
        },
    isFirstInboundMessage,
  })
  const flowConsumed = flowResult.consumed

  const automationTriggers: (
    | 'new_contact_created'
    | 'first_inbound_message'
    | 'new_message_received'
    | 'keyword_match'
  )[] = []
  if (!flowConsumed) {
    automationTriggers.push('new_message_received', 'keyword_match')
  }
  if (contactWasCreated) automationTriggers.unshift('new_contact_created')
  if (isFirstInboundMessage) automationTriggers.unshift('first_inbound_message')
  for (const triggerType of automationTriggers) {
    runAutomationsForTrigger({
      accountId,
      triggerType,
      contactId: contactRecord.id,
      context: {
        message_text: inboundText,
        conversation_id: conversation.id,
      },
    }).catch((err) => console.error('[automations] dispatch failed:', err))
  }

  if (!flowConsumed && !input.interactiveReplyId && inboundText.trim()) {
    await dispatchInboundToAiReply({
      accountId,
      conversationId: conversation.id,
      contactId: contactRecord.id,
      configOwnerUserId,
    })
  }

  // `whatsapp_message_id` is kept as the field name for every channel
  // (not just WhatsApp) even though it now also carries a Messenger mid
  // etc. — it's a documented public-API field (docs/public-api.md) and
  // renaming it would break existing webhook subscribers built against
  // that schema.
  await dispatchWebhookEvent(db, accountId, 'message.received', {
    conversation_id: conversation.id,
    contact_id: contactRecord.id,
    whatsapp_message_id: input.externalMessageId,
    content_type: contentType,
    text: input.contentText,
  })

  return {
    contact: contactRecord,
    contactWasCreated,
    conversation,
    conversationWasCreated: thread.conversationWasCreated,
    isFirstInboundMessage,
    flowConsumed,
  }
}

/**
 * Convenience wrapper for channels with no reaction/short-circuit
 * concept (Messenger, Telegram, ...): resolve the thread and record
 * the message in one call.
 */
export async function ingestInboundMessage(
  input: IngestMessageInput,
): Promise<IngestMessageResult | null> {
  const thread = await resolveContactAndConversation({
    accountId: input.accountId,
    configOwnerUserId: input.configOwnerUserId,
    channel: input.channel,
    identity: input.identity,
    contactName: input.contactName,
  })
  if (!thread) return null
  return recordAndDispatchMessage(thread, input)
}
