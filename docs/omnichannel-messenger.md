# Omnichannel: Messenger (plus the foundation for Instagram/Telegram)

wacrm's AI pipeline, knowledge base, and inbox are no longer WhatsApp-only.
Every conversation and message now carries a `channel` column
(`whatsapp` | `messenger` | `instagram` | `telegram`), and inbound
messages from any channel flow through the same shared core before
reaching the same RAG/AI reply engine.

> **Status:** WhatsApp and Messenger are live. Instagram Direct and
> Telegram share the same foundation but don't have a webhook/adapter
> yet — see [Adding a new channel](#adding-a-new-channel) below.

## What's shared across every channel

- **AI replies + knowledge base** (`src/lib/ai/*`) — the same RAG
  pipeline (hybrid pgvector + full-text search) grounds replies on
  every channel. Nothing to configure per channel; see
  [knowledge-base-sources.md](./knowledge-base-sources.md) for how to
  feed it.
- **Ingestion core** (`src/lib/inbound/ingest-core.ts`) — resolves or
  creates the contact/conversation, persists the message, and fans out
  to automations/flows/AI/outbound webhooks. Every channel's webhook
  calls into this instead of re-implementing it.
- **Outbound routing** (`src/lib/channels/router.ts`) — `sendChannelText()`
  picks the right sender (WhatsApp vs. Messenger) based on the
  conversation's `channel`. The AI auto-reply bot calls this, not a
  channel-specific function directly.

## Contact identity

WhatsApp contacts are still identified by phone number
(`contacts.phone`). Messenger (and future Telegram) contacts have no
phone number — they're identified by their platform ID (a Messenger
PSID) through the `contact_channel_identities` table
(`account_id, channel, external_id → contact_id`). `contacts.phone` is
nullable as of migration `031_channel_foundations.sql` to support this.

A contact who writes in on both WhatsApp and Messenger gets **two
separate conversations** (one per channel) — the uniqueness key is
`(account_id, contact_id, channel)`, not just `(account_id, contact_id)`.

## Setting up Messenger

1. **Settings → Messenger** in the dashboard.
2. In your Meta App dashboard, add the **Messenger** product and
   generate a **Page Access Token** for the Facebook Page you want to
   connect.
3. Copy the **Page ID** (Facebook Page → About) and the **Page Access
   Token** into the wacrm form. Make up a **Webhook Verify Token** —
   any string you choose.
4. Copy the **Webhook Callback URL** wacrm shows you
   (`https://<your-domain>/api/webhooks/meta-omni`).
5. Back in the Meta App dashboard (Messenger → Settings → Webhooks),
   paste that callback URL, enter the same Verify Token, and subscribe
   to the `messages` webhook field. Subscribe your Page to the app.
6. Save the form in wacrm. Send a test message to the Page from
   Messenger — it should appear in the wacrm inbox with a **FB** badge.

> Meta requires the webhook URL to be a real public **HTTPS** address —
> `http://localhost` will not work. Deploy first (see the deployment
> guide) if you're testing this locally.

### First-pass limitations

- Only plain text is handled inbound (no attachments, quick replies, or
  postbacks yet).
- Outbound is plain text only — no Messenger-specific rich formats
  (generic templates, quick replies) yet.
- Messenger and Instagram require Meta **App Review** for
  `pages_messaging` / `instagram_manage_messages` before they work for
  anyone other than your app's own test users/roles — this is a Meta
  process outside wacrm, and can take days.

## Adding a new channel

The foundation (`channel` column, `contact_channel_identities`,
`ingest-core.ts`, `channels/router.ts`) is designed so a new channel is
additive, not a rearchitecture:

1. A config table for the channel's credentials (mirror
   `messenger_config` — see migration `031_channel_foundations.sql`).
2. A webhook route that parses the channel's payload and calls
   `ingestInboundMessage()` (or `resolveContactAndConversation()` +
   `recordAndDispatchMessage()` if the channel has something like
   WhatsApp's reactions that need to short-circuit before the message
   is recorded).
3. A `send.ts` for that channel (mirror `src/lib/messenger/send.ts`),
   wired into `sendChannelText()`'s `switch`.
4. A Settings panel to configure it (mirror
   `src/components/settings/messenger-config.tsx`).

Telegram is the simplest candidate next: no Meta App Review, no OAuth —
just a Bot Token from BotFather and a `setWebhook` call.
