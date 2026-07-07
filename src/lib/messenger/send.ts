import { sendMessengerText as sendViaGraphApi } from './api'
import { decrypt } from '@/lib/whatsapp/encryption'
import { supabaseAdmin } from './admin-client'

// ------------------------------------------------------------
// Messenger sender — mirrors src/lib/flows/meta-send.ts's
// `engineSendText` shape so src/lib/channels/router.ts can treat every
// channel's text sender identically. No phone-variant retry here (that's
// a WhatsApp-only quirk); the PSID is exact or the send fails outright.
// ------------------------------------------------------------

export interface SendMessengerTextArgs {
  accountId: string
  userId: string
  conversationId: string
  contactId: string
  text: string
}

/**
 * Send a plain-text Messenger message for a given conversation/contact.
 * Resolves the Page Access Token from `messenger_config` and the
 * recipient's PSID from `contact_channel_identities`.
 */
export async function sendMessengerText(
  args: SendMessengerTextArgs,
): Promise<{ external_message_id: string }> {
  const db = supabaseAdmin()

  const { data: identity, error: identityErr } = await db
    .from('contact_channel_identities')
    .select('external_id')
    .eq('account_id', args.accountId)
    .eq('contact_id', args.contactId)
    .eq('channel', 'messenger')
    .maybeSingle()
  if (identityErr || !identity?.external_id) {
    throw new Error('no Messenger identity (PSID) found for this contact')
  }

  const { data: config, error: configErr } = await db
    .from('messenger_config')
    .select('*')
    .eq('account_id', args.accountId)
    .single()
  if (configErr || !config) {
    throw new Error('Messenger not configured for this account')
  }

  const pageAccessToken = decrypt(config.page_access_token)

  const { messageId } = await sendViaGraphApi({
    pageAccessToken,
    recipientPsid: identity.external_id,
    text: args.text,
  })

  const { error: msgErr } = await db.from('messages').insert({
    conversation_id: args.conversationId,
    channel: 'messenger',
    sender_type: 'bot',
    content_type: 'text',
    content_text: args.text,
    message_id: messageId,
    status: 'sent',
  })
  if (msgErr) {
    throw new Error(`sent to Messenger but DB insert failed: ${msgErr.message}`)
  }

  await db
    .from('conversations')
    .update({
      last_message_text: args.text,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', args.conversationId)

  return { external_message_id: messageId }
}
