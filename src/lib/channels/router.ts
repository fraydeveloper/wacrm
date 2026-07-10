import { engineSendText } from '@/lib/flows/meta-send'
import { sendMessengerText } from '@/lib/messenger/send'
import { sendTelegramText } from '@/lib/telegram/send'

export type Channel = 'whatsapp' | 'messenger' | 'instagram' | 'telegram'

export interface SendChannelTextArgs {
  channel: Channel
  accountId: string
  userId: string
  conversationId: string
  contactId: string
  text: string
}

/**
 * Send a plain-text reply on whichever channel a conversation belongs to.
 *
 * The single indirection point between the channel-agnostic AI/automation
 * layer and each channel's concrete sender. WhatsApp routes to the
 * existing `engineSendText` unchanged — this file only adds a switch on
 * top of it. Adding a channel later (Instagram, Telegram) is one more
 * `case` here plus that channel's own `send.ts`, nothing upstream changes.
 */
export async function sendChannelText(
  args: SendChannelTextArgs,
): Promise<{ external_message_id: string }> {
  switch (args.channel) {
    case 'whatsapp': {
      const { whatsapp_message_id } = await engineSendText({
        accountId: args.accountId,
        userId: args.userId,
        conversationId: args.conversationId,
        contactId: args.contactId,
        text: args.text,
      })
      return { external_message_id: whatsapp_message_id }
    }
    case 'messenger':
      return sendMessengerText({
        accountId: args.accountId,
        userId: args.userId,
        conversationId: args.conversationId,
        contactId: args.contactId,
        text: args.text,
      })
    case 'telegram':
      return sendTelegramText({
        accountId: args.accountId,
        userId: args.userId,
        conversationId: args.conversationId,
        contactId: args.contactId,
        text: args.text,
      })
    case 'instagram':
      throw new Error(`sendChannelText: channel "${args.channel}" is not implemented yet`)
  }
}
