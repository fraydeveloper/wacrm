import crypto from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./admin-client', () => ({ supabaseAdmin: vi.fn() }))

import { encrypt, decrypt } from '@/lib/whatsapp/encryption'
import {
  appSecretPatch,
  filterPageEntries,
  filterWhatsAppEntries,
  idsSignedByOwnSecret,
} from './meta-account-secrets'

const SECRET_A = 'a'.repeat(32)
const SECRET_B = 'b'.repeat(32)

function sign(body: string, secret: string) {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex')
}

describe('idsSignedByOwnSecret', () => {
  const rows = [
    { ids: ['PNID-A', 'WABA-A'], appSecret: encrypt(SECRET_A) },
    { ids: ['PNID-B', 'WABA-B'], appSecret: encrypt(SECRET_B) },
  ]

  it('trusts only the ids of the account whose secret signed the body', () => {
    const body = '{"entry":[]}'
    const trusted = idsSignedByOwnSecret(rows, body, sign(body, SECRET_A))
    expect([...trusted].sort()).toEqual(['PNID-A', 'WABA-A'])
  })

  it('trusts nothing for a foreign or missing signature', () => {
    const body = '{}'
    expect(idsSignedByOwnSecret(rows, body, sign(body, 'c'.repeat(32))).size).toBe(0)
    expect(idsSignedByOwnSecret(rows, body, null).size).toBe(0)
  })

  it('skips rows whose secret cannot be decrypted', () => {
    const body = '{}'
    const trusted = idsSignedByOwnSecret(
      [{ ids: ['X'], appSecret: 'not-a-ciphertext' }, rows[0]],
      body,
      sign(body, SECRET_A),
    )
    expect([...trusted].sort()).toEqual(['PNID-A', 'WABA-A'])
  })
})

describe('filterWhatsAppEntries', () => {
  const body = {
    entry: [
      {
        id: 'WABA-A',
        changes: [{ value: { metadata: { phone_number_id: 'PNID-A' } } }],
      },
      {
        // Claims another account's number — must be dropped.
        id: 'WABA-B',
        changes: [{ value: { metadata: { phone_number_id: 'PNID-B' } } }],
      },
    ],
  }

  it('keeps only entries/changes belonging to trusted ids', () => {
    const out = filterWhatsAppEntries(body, new Set(['PNID-A', 'WABA-A']))
    expect(out?.entry).toHaveLength(1)
    expect(out?.entry?.[0].id).toBe('WABA-A')
  })

  it('matches template events (no metadata) by WABA id', () => {
    const tpl = { entry: [{ id: 'WABA-A', changes: [{ value: {} }] }] }
    expect(filterWhatsAppEntries(tpl, new Set(['WABA-A']))?.entry).toHaveLength(1)
  })

  it('returns null when nothing is trusted', () => {
    expect(filterWhatsAppEntries(body, new Set())).toBeNull()
  })
})

describe('filterPageEntries', () => {
  it('keeps only trusted Page ids', () => {
    const body = { object: 'page', entry: [{ id: 'PAGE-A' }, { id: 'PAGE-B' }] }
    expect(filterPageEntries(body, new Set(['PAGE-A']))?.entry).toEqual([{ id: 'PAGE-A' }])
    expect(filterPageEntries(body, new Set(['PAGE-C']))).toBeNull()
  })
})

describe('appSecretPatch', () => {
  it('leaves the column untouched when the field is blank', () => {
    expect(appSecretPatch({})).toEqual({ patch: {} })
    expect(appSecretPatch({ app_secret: '   ' })).toEqual({ patch: {} })
  })

  it('clears the secret on request', () => {
    expect(appSecretPatch({ clear_app_secret: true })).toEqual({ patch: { app_secret: null } })
  })

  it('encrypts a valid secret', () => {
    const out = appSecretPatch({ app_secret: ` ${SECRET_A} ` })
    expect('patch' in out && out.patch.app_secret).toBeTruthy()
    if ('patch' in out && out.patch.app_secret) {
      expect(decrypt(out.patch.app_secret)).toBe(SECRET_A)
    }
  })

  it('rejects a malformed secret', () => {
    expect(appSecretPatch({ app_secret: 'too-short' })).toHaveProperty('error')
  })
})
