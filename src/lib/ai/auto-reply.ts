import { supabaseAdmin } from './admin-client'
import { loadAiConfig } from './config'
import { buildConversationContext } from './context'
import { retrieveKnowledge } from './knowledge'
import { generateReply } from './generate'
import { buildSystemPrompt, DEFAULT_HANDOFF_MESSAGE } from './defaults'
import { latestUserMessage } from './query'
import { sendChannelText } from '@/lib/channels/router'
import { notifyHumanOfHandoff } from './handoff-notify'

interface DispatchArgs {
  /** Tenancy key — drives config, contact, and whatsapp_config lookups. */
  accountId: string
  conversationId: string
  contactId: string
  /** The account's WhatsApp config owner, used for the outbound send's
   *  audit columns (mirrors how the flow runner passes it through). */
  configOwnerUserId: string
}

/**
 * AI auto-reply for a freshly-arrived inbound message.
 *
 * Invoked from the WhatsApp webhook's `after()` block, only when no
 * deterministic flow consumed the message (flows win). Mirrors the flow
 * runner's contract: it owns its try/catch and NEVER throws — a failing
 * or slow LLM call must not affect the webhook's 200 to Meta.
 *
 * Eligibility gates (any → silent no-op):
 *   - AI off / auto-reply disabled for the account
 *   - the bot is paused for this conversation's channel
 *   - a human agent is assigned (they own the thread)
 *   - auto-reply was disabled for this conversation (prior handoff)
 *   - the per-conversation reply cap is reached
 *   - there's nothing to reply to
 *
 * The 24h WhatsApp session window is inherently open here — we're
 * reacting to a customer message that just landed — so no separate
 * window check is needed.
 */
export async function dispatchInboundToAiReply(
  args: DispatchArgs,
): Promise<void> {
  const { accountId, conversationId, contactId, configOwnerUserId } = args

  try {
    const db = supabaseAdmin()

    const config = await loadAiConfig(db, accountId)
    if (!config || !config.autoReplyEnabled) return

    // Deterministic, user-configured responders win over the LLM — the
    // caller already excludes messages a Flow consumed. Message-level
    // automations (`new_message_received` / `keyword_match`) are
    // dispatched independently for this same inbound and may send their
    // own reply, so if the account has any active one we stand down to
    // avoid double-texting the customer. (Relationship triggers like
    // `first_inbound_message` don't count — they're not per-message
    // auto-responders.)
    const { data: autoResponders } = await db
      .from('automations')
      .select('id')
      .eq('account_id', accountId)
      .eq('is_active', true)
      .in('trigger_type', ['new_message_received', 'keyword_match'])
      .limit(1)
    if (autoResponders && autoResponders.length > 0) return

    const { data: conv, error: convErr } = await db
      .from('conversations')
      .select('channel, assigned_agent_id, ai_autoreply_disabled, ai_reply_count')
      .eq('id', conversationId)
      .maybeSingle()
    if (convErr || !conv) return
    if (!config.channelsEnabled.includes(conv.channel)) return // paused for this channel
    if (conv.assigned_agent_id) return // a human owns this thread
    if (conv.ai_autoreply_disabled) return // handed off / turned off here
    // Cheap early-out; the authoritative cap check is the atomic claim
    // below (this read can race a concurrent inbound).
    if (conv.ai_reply_count >= config.autoReplyMaxPerConversation) return

    const messages = await buildConversationContext(db, conversationId)
    if (messages.length === 0) return

    // Ground the reply in the account's knowledge base (best-effort).
    const knowledge = await retrieveKnowledge(
      db,
      accountId,
      config,
      latestUserMessage(messages),
    )

    const systemPrompt = buildSystemPrompt({
      userPrompt: config.systemPrompt,
      mode: 'auto_reply',
      knowledge,
    })

    const { text, handoff } = await generateReply({
      config,
      systemPrompt,
      messages,
    })

    if (handoff || !text) {
      // The model can't (or shouldn't) answer. Instead of going silent,
      // tell the customer a human will follow up (with a real contact),
      // ping the team, then hand the thread off: flip
      // `ai_autoreply_disabled` so the bot stands down and the inbox's
      // "Modo humano" takes over. Sticky until an admin re-enables.
      const handoffMessage =
        config.handoffMessage?.trim() || DEFAULT_HANDOFF_MESSAGE

      // Flip the flag FIRST so a racing concurrent inbound can't also
      // enter this branch and double-send the handoff message.
      await db
        .from('conversations')
        .update({ ai_autoreply_disabled: true })
        .eq('id', conversationId)

      // Speak the handoff to the customer (best-effort — a send failure
      // must not stop the human notification below).
      try {
        await sendChannelText({
          channel: conv.channel,
          accountId,
          userId: configOwnerUserId,
          conversationId,
          contactId,
          text: handoffMessage,
        })
      } catch (sendErr) {
        console.error('[ai auto-reply] failed to send handoff message:', sendErr)
      }

      // Alert a human (in-app bell + optional WhatsApp ping). Never throws.
      await notifyHumanOfHandoff({
        accountId,
        conversationId,
        contactId,
        channel: conv.channel,
        notifyNumber: config.handoffNotifyNumber,
      })
      return
    }

    // Atomically claim a reply slot: the cap check + increment happen in
    // one UPDATE, so concurrent inbounds can never overshoot the cap. If
    // another inbound just took the last slot, `claimed` is false and we
    // skip the send. (We consume a slot slightly before the send lands —
    // fail-safe: under-reply rather than over-reply.)
    const { data: claimed, error: claimErr } = await db.rpc(
      'claim_ai_reply_slot',
      {
        conversation_id: conversationId,
        max_replies: config.autoReplyMaxPerConversation,
      },
    )
    if (claimErr || claimed !== true) return

    await sendChannelText({
      channel: conv.channel,
      accountId,
      userId: configOwnerUserId,
      conversationId,
      contactId,
      text,
    })
  } catch (err) {
    console.error('[ai auto-reply] dispatch failed:', err)
  }
}
