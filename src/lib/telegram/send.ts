import { sendTelegramText as sendViaTelegramApi } from './api'
import { decrypt } from '@/lib/whatsapp/encryption'
import { supabaseAdmin } from './admin-client'

// ------------------------------------------------------------
// Telegram sender — mirrors src/lib/messenger/send.ts so
// src/lib/channels/router.ts can treat every channel's text sender
// identically. The recipient is a Telegram chat id (stored as the
// contact's channel identity's external_id).
// ------------------------------------------------------------

export interface SendTelegramTextArgs {
  accountId: string
  userId: string
  conversationId: string
  contactId: string
  text: string
}

/**
 * Send a plain-text Telegram message for a given conversation/contact.
 * Resolves the bot token from `telegram_config` and the recipient's chat
 * id from `contact_channel_identities`.
 */
export async function sendTelegramText(
  args: SendTelegramTextArgs,
): Promise<{ external_message_id: string }> {
  const db = supabaseAdmin()

  const { data: identity, error: identityErr } = await db
    .from('contact_channel_identities')
    .select('external_id')
    .eq('account_id', args.accountId)
    .eq('contact_id', args.contactId)
    .eq('channel', 'telegram')
    .maybeSingle()
  if (identityErr || !identity?.external_id) {
    throw new Error('no Telegram identity (chat id) found for this contact')
  }

  const { data: config, error: configErr } = await db
    .from('telegram_config')
    .select('bot_token')
    .eq('account_id', args.accountId)
    .single()
  if (configErr || !config) {
    throw new Error('Telegram not configured for this account')
  }

  const botToken = decrypt(config.bot_token)

  const { messageId } = await sendViaTelegramApi({
    botToken,
    chatId: identity.external_id,
    text: args.text,
  })

  const { error: msgErr } = await db.from('messages').insert({
    conversation_id: args.conversationId,
    channel: 'telegram',
    sender_type: 'bot',
    content_type: 'text',
    content_text: args.text,
    message_id: messageId,
    status: 'sent',
  })
  if (msgErr) {
    throw new Error(`sent to Telegram but DB insert failed: ${msgErr.message}`)
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
