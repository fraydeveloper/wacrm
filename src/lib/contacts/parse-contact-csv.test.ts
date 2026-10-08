import { describe, expect, it } from 'vitest';
import {
  cleanImportPhone,
  CONTACT_CSV_TEMPLATE,
  parseContactCsv,
  parseTagCell,
} from './parse-contact-csv';

describe('parseTagCell', () => {
  it('splits comma-separated tags and trims whitespace', () => {
    expect(parseTagCell(' VIP , Lead ,  ')).toEqual(['VIP', 'Lead']);
  });

  it('splits semicolon-separated tags', () => {
    expect(parseTagCell('VIP; Lead; Customer')).toEqual([
      'VIP',
      'Lead',
      'Customer',
    ]);
  });

  it('de-dupes case-insensitively', () => {
    expect(parseTagCell('vip, VIP, Lead')).toEqual(['vip', 'Lead']);
  });

  it('returns empty for blank values', () => {
    expect(parseTagCell('')).toEqual([]);
    expect(parseTagCell(undefined)).toEqual([]);
  });
});

describe('parseContactCsv', () => {
  it('parses optional tags column', () => {
    const csv = `phone,name,tags
+15551234567,Alice,"VIP, Lead"
+15559876543,Bob,Customer`;

    expect(parseContactCsv(csv)).toEqual({
      hasTagsColumn: true,
      hasCompanyColumn: false,
      invalidRows: [],
      missingPhoneColumn: false,
      rows: [
        {
          phone: '+15551234567',
          name: 'Alice',
          email: undefined,
          company: undefined,
          tagNames: ['VIP', 'Lead'],
        },
        {
          phone: '+15559876543',
          name: 'Bob',
          email: undefined,
          company: undefined,
          tagNames: ['Customer'],
        },
      ],
    });
  });

  it('returns empty tagNames when tags column is absent', () => {
    const csv = `phone,name
+15551234567,Alice`;

    expect(parseContactCsv(csv)).toEqual({
      hasTagsColumn: false,
      hasCompanyColumn: false,
      invalidRows: [],
      missingPhoneColumn: false,
      rows: [
        {
          phone: '+15551234567',
          name: 'Alice',
          email: undefined,
          company: undefined,
          tagNames: [],
        },
      ],
    });
  });
});

const NL = String.fromCharCode(10);
const BOM = String.fromCharCode(0xfeff);
const lines = (...l: string[]) => l.join(NL);

describe('parseContactCsv — real-world files', () => {
  it('strips the UTF-8 BOM Excel adds to the first header', () => {
    const r = parseContactCsv(BOM + lines('phone,name', '+51987654321,Ana'));
    expect(r.missingPhoneColumn).toBe(false);
    expect(r.rows).toHaveLength(1);
  });

  it('detects semicolon delimiters (Excel ES/EU)', () => {
    const csv = lines(
      'telefono;nombre;correo',
      '987654321;María Pérez;maria@example.com',
    );
    const r = parseContactCsv(csv, { defaultCountryCode: '51' });
    expect(r.rows[0]).toMatchObject({
      phone: '+51987654321',
      name: 'María Pérez',
      email: 'maria@example.com',
    });
  });

  it('accepts Spanish headers with accents and joins first + last name', () => {
    const csv = lines(
      'Teléfono,Nombres,Apellidos,Empresa,Etiquetas',
      '+51 987 654 321,Juan,Quispe,ACME,"VIP; Lead"',
    );
    const r = parseContactCsv(csv);
    expect(r.hasCompanyColumn).toBe(true);
    expect(r.hasTagsColumn).toBe(true);
    expect(r.rows[0]).toEqual({
      phone: '+51987654321',
      name: 'Juan Quispe',
      email: undefined,
      company: 'ACME',
      tagNames: ['VIP', 'Lead'],
    });
  });

  it('handles escaped quotes and line breaks inside quoted cells', () => {
    const csv = lines(
      'phone,name,company',
      '+15551234567,"Bob ""B"" Smith","Line 1',
      'Line 2"',
      '+15559876543,Ann,',
    );
    const r = parseContactCsv(csv);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0].name).toBe('Bob "B" Smith');
    expect(r.rows[0].company).toBe(`Line 1${NL}Line 2`);
  });

  it('reports invalid phones with their line number instead of importing them', () => {
    const csv = lines(
      'phone,name',
      '5.19877E+10,Bad',
      '123,Short',
      ',Empty',
      '+51987654321,Good',
    );
    const r = parseContactCsv(csv);
    expect(r.rows.map((x) => x.name)).toEqual(['Good']);
    expect(r.invalidRows.map((x) => x.line)).toEqual([2, 3, 4]);
  });

  it('flags a file without a phone column', () => {
    const r = parseContactCsv(lines('name,email', 'Ana,a@b.co'));
    expect(r.missingPhoneColumn).toBe(true);
    expect(r.rows).toEqual([]);
  });

  it('drops malformed e-mails but keeps the contact', () => {
    const r = parseContactCsv(lines('phone,email', '+51987654321,not-an-email'));
    expect(r.rows[0].email).toBeUndefined();
  });

  it('parses its own downloadable template', () => {
    const r = parseContactCsv(CONTACT_CSV_TEMPLATE, { defaultCountryCode: '51' });
    expect(r.invalidRows).toEqual([]);
    expect(r.rows).toHaveLength(3);
    expect(r.rows[2].phone).toBe('+51987111222');
  });
});

describe('cleanImportPhone', () => {
  it('keeps international numbers as +digits', () => {
    expect(cleanImportPhone('+51 (987) 654-321')).toEqual({
      ok: true,
      phone: '+51987654321',
    });
    expect(cleanImportPhone('0051987654321')).toEqual({
      ok: true,
      phone: '+51987654321',
    });
  });

  it('adds the default country code to local numbers only', () => {
    expect(cleanImportPhone('987654321', '51')).toEqual({
      ok: true,
      phone: '+51987654321',
    });
    expect(cleanImportPhone('51987654321', '51')).toEqual({
      ok: true,
      phone: '+51987654321',
    });
    expect(cleanImportPhone('+34612345678', '51')).toEqual({
      ok: true,
      phone: '+34612345678',
    });
  });

  it('rejects numbers that cannot reach WhatsApp', () => {
    expect(cleanImportPhone('12345').ok).toBe(false);
    expect(cleanImportPhone('5.19877E+10').ok).toBe(false);
    expect(cleanImportPhone('0987654321').ok).toBe(false);
  });
});
