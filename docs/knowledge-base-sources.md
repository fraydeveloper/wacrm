# Knowledge base: file upload &amp; Google Sheets sync

The AI knowledge base (**Settings → AI Agents → Knowledge base**) grounds
every draft and auto-reply, on every channel (see
[omnichannel-messenger.md](./omnichannel-messenger.md)). Besides pasting
text by hand, documents can come from an uploaded file or a Google
Sheet.

Every source funnels through the same chunking + (optional) embedding
pipeline (`src/lib/ai/knowledge.ts`) — retrieval doesn't know or care
where a document came from.

## Uploading a file

Click **Upload file** and pick a `.md`, `.markdown`, `.txt`, or `.pdf`
file (max 15 MB).

- `.md` / `.markdown` / `.txt` are stored as-is.
- `.pdf` text is extracted server-side (`pdf-parse`) — scanned/
  image-only PDFs with no text layer won't extract anything useful.

The document title defaults to the filename; edit it afterward like any
other document (pencil icon).

## Google Sheets

Sheets are pulled in via a **Service Account** (not your personal
Google login) and synced **on demand** — there's no automatic polling,
so a change in the sheet only reaches wacrm when someone clicks **Sync
now**.

### One-time setup: connect a Service Account

1. In [Google Cloud Console](https://console.cloud.google.com/), create
   (or pick) a project, then **IAM & Admin → Service Accounts → Create
   Service Account**. Any name works.
2. Open the new service account → **Keys → Add key → Create new key →
   JSON**. This downloads a `.json` file — treat it like a password.
3. Enable the **Google Sheets API** for the project (APIs & Services →
   Library → search "Google Sheets API" → Enable).
4. In wacrm, **Settings → AI Agents → Knowledge base → Google Sheets →
   Connect**, and paste the full contents of the downloaded JSON file.
5. wacrm shows you the service account's email
   (`...@<project>.iam.gserviceaccount.com`) — **share every spreadsheet
   you want indexed with that email**, exactly like sharing a Doc with a
   coworker (Viewer access is enough).

The key is stored encrypted (same AES-256-GCM as WhatsApp/Messenger
tokens) and is shared by every sheet the account connects — connect
once per wacrm account, not per sheet.

### Adding a sheet

**Add from Google Sheet**, then fill in:

- **Title** — whatever you want it labeled as in the knowledge base.
- **Spreadsheet URL or ID** — paste the full URL from your browser, or
  just the ID.
- **Sheet / range** — the tab name (e.g. `Sheet1`) or a specific range
  (e.g. `Sheet1!A:D`). Defaults to `Sheet1`.

The **first row is treated as column headers.** Each following row
becomes one retrievable block, formatted as `Header: value` pairs — so
a pricing sheet with columns `Plan`, `Price`, `Includes` becomes chunks
like:

```
Plan: Pro
Price: $49/mo
Includes: Unlimited contacts, 3 seats
```

### Keeping it up to date

Sheet-backed documents show a **Sync now** button and the timestamp of
the last sync. Click it after editing the source spreadsheet — there is
intentionally no cron job doing this automatically. If you need
real-time push instead of on-demand sync, that would require setting up
a Google Apps Script trigger on your own spreadsheet to call a wacrm
endpoint on edit — not built in today.

### Disconnecting

**Disconnect** under the Google Sheets card removes the stored key.
Already-synced documents keep their last-fetched content — they just
can't be re-synced until a key is connected again.
