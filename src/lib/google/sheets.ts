import crypto from 'crypto'
import { AiError } from '@/lib/ai/types'

/**
 * Minimal Google Sheets (read-only) client authenticated with a Service
 * Account key — no `googleapis` SDK, same "hand-rolled REST + fetch"
 * style as src/lib/whatsapp/meta-api.ts and src/lib/messenger/api.ts.
 * We only need one scope and two endpoints, so the SDK's weight isn't
 * worth it.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly'
const TOKEN_TTL_SECONDS = 3600

export interface ServiceAccountKey {
  client_email: string
  private_key: string
}

/** Parse + shape-check a pasted Service Account JSON key. */
export function parseServiceAccountKey(raw: string): ServiceAccountKey {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new AiError('Not valid JSON.', { code: 'invalid_json', status: 400 })
  }
  const obj = parsed as Record<string, unknown>
  const clientEmail = obj?.client_email
  const privateKey = obj?.private_key
  if (typeof clientEmail !== 'string' || !clientEmail) {
    throw new AiError('Missing "client_email" in the service account key.', {
      code: 'invalid_service_account',
      status: 400,
    })
  }
  if (typeof privateKey !== 'string' || !privateKey) {
    throw new AiError('Missing "private_key" in the service account key.', {
      code: 'invalid_service_account',
      status: 400,
    })
  }
  return { client_email: clientEmail, private_key: privateKey }
}

function base64url(input: Buffer | string): string {
  return (Buffer.isBuffer(input) ? input : Buffer.from(input)).toString('base64url')
}

/**
 * Exchange a Service Account key for a short-lived OAuth access token via
 * the standard JWT-bearer grant (RFC 7523). Signs a claim set with the
 * account's RSA private key — no external auth library needed, Node's
 * `crypto` does RS256 natively.
 */
export async function getAccessToken(key: ServiceAccountKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claimSet = base64url(
    JSON.stringify({
      iss: key.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + TOKEN_TTL_SECONDS,
    }),
  )
  const signingInput = `${header}.${claimSet}`
  const signature = base64url(
    crypto.sign('RSA-SHA256', Buffer.from(signingInput), key.private_key),
  )
  const jwt = `${signingInput}.${signature}`

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new AiError(`Google auth failed: ${response.status} ${body}`.trim(), {
      code: 'google_auth_failed',
      status: 502,
    })
  }

  const data = (await response.json()) as { access_token?: string }
  if (!data.access_token) {
    throw new AiError('Google auth response had no access_token.', {
      code: 'google_auth_failed',
      status: 502,
    })
  }
  return data.access_token
}

/**
 * Accepts either a bare spreadsheet ID or a full Google Sheets URL
 * (`https://docs.google.com/spreadsheets/d/<ID>/edit#gid=0`) and returns
 * the ID.
 */
export function parseSpreadsheetId(input: string): string {
  const trimmed = input.trim()
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (match) return match[1]
  if (/^[a-zA-Z0-9-_]+$/.test(trimmed)) return trimmed
  throw new AiError('Could not parse a spreadsheet ID from that value.', {
    code: 'invalid_spreadsheet_id',
    status: 400,
  })
}

/** Fetch a range's raw values (rows of cell strings) from the Sheets API. */
export async function fetchSheetValues(args: {
  accessToken: string
  spreadsheetId: string
  range: string
}): Promise<string[][]> {
  const { accessToken, spreadsheetId, range } = args
  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}`
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new AiError(`Google Sheets API error: ${response.status} ${body}`.trim(), {
      code: 'sheets_api_error',
      status: response.status === 404 ? 404 : 502,
    })
  }
  const data = (await response.json()) as { values?: string[][] }
  return data.values ?? []
}

/**
 * Convert a values grid into plain text the existing chunker can work
 * with: the first row is treated as headers, and every following row
 * becomes a `Header: value` block separated by blank lines — chunkText
 * (src/lib/ai/chunk.ts) splits on blank lines, so each spreadsheet row
 * naturally becomes its own retrievable unit.
 */
export function sheetValuesToText(values: string[][]): string {
  if (values.length === 0) return ''
  const [headerRow, ...rows] = values
  return rows
    .filter((row) => row.some((cell) => cell?.trim()))
    .map((row) =>
      headerRow
        .map((header, i) => `${header || `Column ${i + 1}`}: ${row[i] ?? ''}`)
        .join('\n'),
    )
    .join('\n\n')
}
