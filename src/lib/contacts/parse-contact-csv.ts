/**
 * CSV parsing for the contacts import modal and the broadcast "upload
 * CSV" audience. Shared + unit-tested so both paths agree on headers,
 * delimiters and phone clean-up.
 *
 * Real-world files this has to survive (most come straight out of
 * Excel / Google Sheets):
 *   - UTF-8 BOM on the first header ("﻿phone").
 *   - `;` as the delimiter — Excel in Spanish/European locales exports
 *     "CSV" with semicolons because `,` is the decimal separator.
 *   - Spanish headers (teléfono, nombre, correo, empresa, etiquetas).
 *   - Quoted cells with commas, escaped quotes ("") and line breaks.
 *   - Local numbers without a country code ("987 654 321").
 *   - Excel's scientific notation for long numbers ("5.19877E+10"),
 *     which has lost digits and can't be recovered.
 */

export interface ParsedContactRow {
  /** Cleaned phone: "+<digits>" when it could be normalized. */
  phone: string;
  name?: string;
  email?: string;
  company?: string;
  /** Tag names from the optional `tags` column (comma/semicolon separated). */
  tagNames: string[];
}

export interface InvalidContactRow {
  /** 1-based line number in the file (header = line 1). */
  line: number;
  /** The phone cell as it appeared in the file. */
  value: string;
  reason: string;
}

export interface ParseContactCsvOptions {
  /**
   * Digits-only country calling code (e.g. "51" for Peru) prepended to
   * numbers written without an international prefix. Empty/undefined →
   * numbers are kept as written.
   */
  defaultCountryCode?: string;
}

export interface ParseContactCsvResult {
  rows: ParsedContactRow[];
  /** True when the CSV header includes a `tags` column. */
  hasTagsColumn: boolean;
  /** True when the CSV header includes a `company` column. */
  hasCompanyColumn: boolean;
  /** Rows dropped because their phone can't be sent to WhatsApp. */
  invalidRows: InvalidContactRow[];
  /** True when no recognizable phone column exists in the header. */
  missingPhoneColumn: boolean;
}

/** Column headers accepted for each field (compared accent/case-insensitively). */
const HEADER_ALIASES = {
  phone: [
    'phone',
    'phone_number',
    'phonenumber',
    'mobile',
    'telefono',
    'tel',
    'celular',
    'movil',
    'whatsapp',
    'numero',
    'numero_de_telefono',
    'numero_telefono',
    'nro',
  ],
  name: ['name', 'full_name', 'nombre', 'nombres', 'nombre_completo', 'first_name'],
  lastName: ['last_name', 'apellido', 'apellidos'],
  email: ['email', 'e_mail', 'mail', 'correo', 'correo_electronico'],
  company: ['company', 'empresa', 'negocio', 'organizacion', 'institucion', 'colegio'],
  tags: ['tags', 'tag', 'etiquetas', 'etiqueta'],
} as const;

function normalizeHeader(raw: string): string {
  return raw
    .replace(/^﻿/, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s\-.]+/g, '_')
    .replace(/_+$/g, '');
}

function findColumn(
  headers: string[],
  aliases: ReadonlyArray<string>,
): number {
  for (const alias of aliases) {
    const idx = headers.indexOf(alias);
    if (idx !== -1) return idx;
  }
  return -1;
}

/** Split a CSV cell into unique tag names (case-insensitive de-dupe). */
export function parseTagCell(value: string | undefined): string[] {
  if (!value?.trim()) return [];

  const seen = new Set<string>();
  const names: string[] = [];

  for (const part of value.split(/[,;]/)) {
    const name = part.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }

  return names;
}

export type PhoneCleanResult =
  | { ok: true; phone: string }
  | { ok: false; reason: string };

/**
 * Turn a phone cell into "+<digits>" ready for WhatsApp, or explain why
 * it can't be used. WhatsApp needs the full international number
 * (country code + number, 8–15 digits).
 */
export function cleanImportPhone(
  raw: string,
  defaultCountryCode?: string,
): PhoneCleanResult {
  const value = raw.trim();
  if (!value) return { ok: false, reason: 'Teléfono vacío' };

  if (/\d[.,]\d*e\+?\d+/i.test(value)) {
    return {
      ok: false,
      reason:
        'Excel lo convirtió en notación científica (formatea la columna como Texto)',
    };
  }

  const international = value.startsWith('+') || value.startsWith('00');
  let digits = value.replace(/\D/g, '');
  if (value.startsWith('00')) digits = digits.replace(/^00/, '');

  const cc = (defaultCountryCode ?? '').replace(/\D/g, '');
  if (!international && cc && digits.length > 0 && digits.length <= 10) {
    // Local number: drop a domestic trunk 0 and add the country code.
    digits = cc + digits.replace(/^0+/, '');
  }

  if (digits.length < 8) {
    return { ok: false, reason: 'Número demasiado corto (falta el código de país)' };
  }
  if (digits.length > 15) {
    return { ok: false, reason: 'Número demasiado largo' };
  }
  if (digits.startsWith('0')) {
    return { ok: false, reason: 'Falta el código de país' };
  }
  return { ok: true, phone: `+${digits}` };
}

/**
 * Pick the delimiter that splits the header into the most columns.
 * Handles `,` (default), `;` (Excel ES/EU) and tab (copy-paste).
 */
function detectDelimiter(headerLine: string): string {
  const candidates = [',', ';', '\t'];
  let best = ',';
  let bestCount = 0;
  for (const d of candidates) {
    let count = 0;
    let inQuotes = false;
    for (const ch of headerLine) {
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === d && !inQuotes) count++;
    }
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

/**
 * RFC-4180 style parse: quoted fields, `""` escapes, delimiters and
 * line breaks inside quotes. Returns each record with its starting
 * line number so errors can point at the right row.
 */
export function parseCsvRecords(
  text: string,
  delimiter?: string,
): { records: string[][]; lines: number[] } {
  const src = text.replace(/^﻿/, '');
  const firstLineEnd = src.search(/\r?\n/);
  const delim =
    delimiter ?? detectDelimiter(firstLineEnd === -1 ? src : src.slice(0, firstLineEnd));

  const records: string[][] = [];
  const lines: number[] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;

  const pushRecord = () => {
    record.push(field);
    field = '';
    if (record.some((v) => v.trim() !== '')) {
      records.push(record);
      lines.push(recordLine);
    }
    record = [];
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === '\n') line++;
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      record.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      pushRecord();
      line++;
      recordLine = line;
    } else {
      field += ch;
    }
  }
  if (field !== '' || record.length > 0) pushRecord();

  return { records, lines };
}

export function parseContactCsv(
  text: string,
  options: ParseContactCsvOptions = {},
): ParseContactCsvResult {
  const empty: ParseContactCsvResult = {
    rows: [],
    hasTagsColumn: false,
    hasCompanyColumn: false,
    invalidRows: [],
    missingPhoneColumn: false,
  };

  const { records, lines } = parseCsvRecords(text);
  if (records.length < 2) {
    return {
      ...empty,
      missingPhoneColumn:
        records.length === 0 ||
        findColumn(records[0].map(normalizeHeader), HEADER_ALIASES.phone) === -1,
    };
  }

  const headers = records[0].map(normalizeHeader);
  const phoneIdx = findColumn(headers, HEADER_ALIASES.phone);
  if (phoneIdx === -1) {
    return { ...empty, missingPhoneColumn: true };
  }

  const nameIdx = findColumn(headers, HEADER_ALIASES.name);
  const lastNameIdx = findColumn(headers, HEADER_ALIASES.lastName);
  const emailIdx = findColumn(headers, HEADER_ALIASES.email);
  const companyIdx = findColumn(headers, HEADER_ALIASES.company);
  const tagsIdx = findColumn(headers, HEADER_ALIASES.tags);

  const cell = (values: string[], idx: number): string | undefined =>
    idx >= 0 ? values[idx]?.trim() || undefined : undefined;

  const rows: ParsedContactRow[] = [];
  const invalidRows: InvalidContactRow[] = [];

  for (let i = 1; i < records.length; i++) {
    const values = records[i];
    const rawPhone = values[phoneIdx]?.trim() ?? '';
    if (!rawPhone) {
      invalidRows.push({ line: lines[i], value: '', reason: 'Teléfono vacío' });
      continue;
    }

    const cleaned = cleanImportPhone(rawPhone, options.defaultCountryCode);
    if (!cleaned.ok) {
      invalidRows.push({ line: lines[i], value: rawPhone, reason: cleaned.reason });
      continue;
    }

    const first = cell(values, nameIdx);
    const last = cell(values, lastNameIdx);
    const fullName = [first, last].filter(Boolean).join(' ') || undefined;

    const email = cell(values, emailIdx);

    rows.push({
      phone: cleaned.phone,
      name: fullName,
      // A malformed e-mail would be rejected by nothing downstream but
      // looks broken in the UI; keep only plausible addresses.
      email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined,
      company: cell(values, companyIdx),
      tagNames: tagsIdx >= 0 ? parseTagCell(values[tagsIdx]) : [],
    });
  }

  return {
    rows,
    hasTagsColumn: tagsIdx >= 0,
    hasCompanyColumn: companyIdx >= 0,
    invalidRows,
    missingPhoneColumn: false,
  };
}

/**
 * Example file offered as "Descargar plantilla". Semicolon-free on
 * purpose: comma-delimited with the tag list quoted, which both Excel
 * and Google Sheets open correctly. Prefixed with a BOM so Excel reads
 * accents (ñ, á) as UTF-8.
 */
export const CONTACT_CSV_TEMPLATE =
  '﻿' +
  [
    'phone,name,email,company,tags',
    '+51987654321,María Pérez,maria@example.com,Colegio San José,"Cliente, VIP"',
    '+51912345678,Juan Quispe,,,"Prospecto"',
    '987111222,Ana Torres,ana@example.com,,',
  ].join('\r\n') +
  '\r\n';

/** Trigger a browser download of the example CSV. Client-only. */
export function downloadContactCsvTemplate(filename = 'plantilla-contactos.csv') {
  const blob = new Blob([CONTACT_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Country codes offered in the "number without prefix" picker. */
export const IMPORT_COUNTRY_CODES: { code: string; label: string }[] = [
  { code: '51', label: 'Perú (+51)' },
  { code: '52', label: 'México (+52)' },
  { code: '57', label: 'Colombia (+57)' },
  { code: '56', label: 'Chile (+56)' },
  { code: '54', label: 'Argentina (+54)' },
  { code: '593', label: 'Ecuador (+593)' },
  { code: '591', label: 'Bolivia (+591)' },
  { code: '58', label: 'Venezuela (+58)' },
  { code: '34', label: 'España (+34)' },
  { code: '1', label: 'EE. UU. / Canadá (+1)' },
  { code: '', label: 'No agregar (ya incluyen código)' },
];

export const DEFAULT_IMPORT_COUNTRY_CODE = '51';
