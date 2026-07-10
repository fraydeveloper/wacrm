import { supabaseAdmin } from './admin-client'
import { decrypt } from '@/lib/whatsapp/encryption'
import { sendTextMessage } from '@/lib/whatsapp/meta-api'
import {
  sanitizePhoneForMeta,
  isValidE164,
  phoneVariants,
  isRecipientNotAllowedError,
} from '@/lib/whatsapp/phone-utils'

// ============================================================
// Human-handoff notifications.
//
// Fired from the AI auto-reply path when the bot hands a conversation
// off to a human (see src/lib/ai/auto-reply.ts). Two independent,
// best-effort channels — neither throws, so a failure never blocks the
// handoff itself (the conversation is already flagged for a human):
//
//   1. In-app bell notification for every admin/owner of the account
//      (`notifications` table, type 'ai_handoff'). Always reliable.
//   2. A WhatsApp text to a configured "notify number" so a human is
//      pinged on their phone. Only lands inside the 24h WhatsApp
//      session window (Meta rule) — outside it, Meta needs a template,
//      so we log-and-move-on rather than pretend it was delivered.
// ============================================================

interface HandoffNotifyArgs {
  accountId: string
  conversationId: string
  contactId: string
  /** Channel the customer is on ('whatsapp' | 'messenger' | ...). */
  channel: string
  /** Optional WhatsApp number to ping. Skipped when null/empty. */
  notifyNumber: string | null
}

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  messenger: 'Messenger',
  instagram: 'Instagram',
  telegram: 'Telegram',
}

export async function notifyHumanOfHandoff(args: HandoffNotifyArgs): Promise<void> {
  const db = supabaseAdmin()

  // Resolve the contact's display name for both notification bodies.
  let contactName = 'un contacto'
  try {
    const { data: contact } = await db
      .from('contacts')
      .select('name, phone')
      .eq('id', args.contactId)
      .maybeSingle()
    contactName = contact?.name || contact?.phone || contactName
  } catch (err) {
    console.error('[ai handoff] failed to load contact for notification:', err)
  }

  const channelLabel = CHANNEL_LABEL[args.channel] ?? args.channel
  const title = 'La IA derivó un chat a un humano'
  const body = `La IA no pudo responder a ${contactName} (${channelLabel}) y necesita atención humana.`

  // 1) In-app notifications for every admin/owner of the account.
  await createInAppNotifications(args, title, body)

  // 2) Best-effort WhatsApp ping to the notify number.
  if (args.notifyNumber && args.notifyNumber.trim()) {
    await pingWhatsAppNumber(args.accountId, args.notifyNumber.trim(), body)
  }
}

async function createInAppNotifications(
  args: HandoffNotifyArgs,
  title: string,
  body: string,
): Promise<void> {
  const db = supabaseAdmin()
  try {
    // Admins + owners own escalations; agents get pinged when a chat is
    // explicitly assigned to them (existing 'conversation_assigned' flow),
    // so we don't fan out to every agent here.
    const { data: recipients, error } = await db
      .from('profiles')
      .select('user_id')
      .eq('account_id', args.accountId)
      .in('account_role', ['owner', 'admin'])

    if (error || !recipients || recipients.length === 0) {
      if (error) console.error('[ai handoff] failed to load recipients:', error)
      return
    }

    const rows = recipients.map((r: { user_id: string }) => ({
      account_id: args.accountId,
      user_id: r.user_id,
      type: 'ai_handoff',
      conversation_id: args.conversationId,
      contact_id: args.contactId,
      actor_user_id: null,
      title,
      body,
    }))

    const { error: insErr } = await db.from('notifications').insert(rows)
    if (insErr) console.error('[ai handoff] failed to insert notifications:', insErr)
  } catch (err) {
    console.error('[ai handoff] in-app notification error:', err)
  }
}

async function pingWhatsAppNumber(
  accountId: string,
  rawNumber: string,
  body: string,
): Promise<void> {
  const db = supabaseAdmin()
  try {
    const { data: config, error } = await db
      .from('whatsapp_config')
      .select('phone_number_id, access_token')
      .eq('account_id', accountId)
      .maybeSingle()
    if (error || !config?.access_token || !config.phone_number_id) {
      console.warn('[ai handoff] no WhatsApp config to send the human alert from — skipped.')
      return
    }

    const sanitized = sanitizePhoneForMeta(rawNumber)
    if (!isValidE164(sanitized)) {
      console.warn(`[ai handoff] notify number is not valid E.164: ${rawNumber} — skipped.`)
      return
    }

    const accessToken = decrypt(config.access_token)
    const alertText = `🔔 ${body}\n\nAbre la bandeja de entrada para responder.`

    // Same phone-variant retry as the flow/automation senders — trunk-0
    // and Meta sandbox quirks otherwise reject an otherwise-valid number.
    let lastError: unknown = null
    for (const v of phoneVariants(sanitized)) {
      try {
        await sendTextMessage({
          phoneNumberId: config.phone_number_id,
          accessToken,
          to: v,
          text: alertText,
        })
        return
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (!isRecipientNotAllowedError(msg)) throw err
        lastError = err
      }
    }
    if (lastError) throw lastError
  } catch (err) {
    // Outside the 24h window Meta rejects free-form text (needs a
    // template). We surface it but never let it break the handoff — the
    // in-app notification already fired.
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(
      `[ai handoff] WhatsApp alert to ${rawNumber} failed (this is expected outside the 24h session window): ${msg}`,
    )
  }
}
