// =============================================
// CRM BUILDER — importação de cards por arquivo .csv
// Parser + normalizadores + validação, sem dependência externa.
// =============================================
import type { CRMCustomField } from '../hooks/useCRMCustomFields';
import type { DealPriority } from '../types';

export const CSV_IMPORT_MAX_ROWS = 2000;

/** Campos nativos do card que podem ser preenchidos pelo CSV. */
export type DealCsvField =
  | 'titulo'
  | 'descricao'
  | 'valor'
  | 'prioridade'
  | 'nome'
  | 'telefone'
  | 'email'
  | 'tags'
  | 'responsavel'
  | 'data_prevista';

export const DEAL_CSV_FIELDS: { key: DealCsvField; label: string; aliases: string[] }[] = [
  { key: 'titulo', label: 'Título', aliases: ['titulo', 'title', 'card', 'assunto', 'negocio', 'negócio'] },
  { key: 'descricao', label: 'Descrição', aliases: ['descricao', 'descrição', 'description', 'obs', 'observacao', 'observação'] },
  { key: 'valor', label: 'Valor (R$)', aliases: ['valor', 'value', 'preco', 'preço', 'amount'] },
  { key: 'prioridade', label: 'Prioridade', aliases: ['prioridade', 'priority'] },
  { key: 'nome', label: 'Nome do contato', aliases: ['nome', 'name', 'contato', 'cliente', 'lead'] },
  { key: 'telefone', label: 'Telefone', aliases: ['telefone', 'phone', 'whatsapp', 'celular', 'fone'] },
  { key: 'email', label: 'E-mail', aliases: ['email', 'e-mail', 'mail'] },
  { key: 'tags', label: 'Tags', aliases: ['tags', 'etiquetas', 'tag'] },
  { key: 'responsavel', label: 'Responsável', aliases: ['responsavel', 'responsável', 'assigned_to', 'owner', 'atendente'] },
  { key: 'data_prevista', label: 'Data prevista', aliases: ['data_prevista', 'data prevista', 'previsao', 'previsão', 'expected_close_date', 'fechamento'] },
];

/** Valor especial para "não importar esta coluna". */
export const CSV_IGNORE = '__ignore__';

// ---------------------------------------------
// Parser
// ---------------------------------------------

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  delimiter: string;
  /** true quando o arquivo excedeu o limite e foi truncado. */
  truncated: boolean;
}

function detectDelimiter(firstLine: string): string {
  const counts: Record<string, number> = {
    ',': 0,
    ';': 0,
    '\t': 0,
  };
  let inQuotes = false;
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch in counts) counts[ch] += 1;
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : ',';
}

/** Parser de CSV com suporte a aspas, quebras dentro de célula, BOM e CRLF. */
export function parseCsv(raw: string): ParsedCsv {
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const firstLineEnd = text.indexOf('\n');
  const firstLine = firstLineEnd === -1 ? text : text.slice(0, firstLineEnd);
  const delimiter = detectDelimiter(firstLine);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const cleaned = rows
    .map((r) => r.map((c) => c.trim()))
    .filter((r) => r.some((c) => c.length > 0));

  const headers = (cleaned.shift() ?? []).map((h) => h.trim());
  const truncated = cleaned.length > CSV_IMPORT_MAX_ROWS;

  return {
    headers,
    rows: truncated ? cleaned.slice(0, CSV_IMPORT_MAX_ROWS) : cleaned,
    delimiter,
    truncated,
  };
}

function slug(v: string): string {
  return v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Mapeamento automático coluna → campo. Reconhece os campos nativos pelos
 * apelidos e os campos adicionais do quadro pelo `field_name`/`field_label`.
 */
export function autoMapHeaders(
  headers: string[],
  customFields: CRMCustomField[],
): Record<number, string> {
  const map: Record<number, string> = {};
  const used = new Set<string>();

  headers.forEach((header, index) => {
    const s = slug(header);
    if (!s) {
      map[index] = CSV_IGNORE;
      return;
    }

    const native = DEAL_CSV_FIELDS.find(
      (f) => !used.has(f.key) && (slug(f.key) === s || f.aliases.some((a) => slug(a) === s)),
    );
    if (native) {
      map[index] = native.key;
      used.add(native.key);
      return;
    }

    const custom = customFields.find(
      (f) =>
        !used.has(`cf:${f.field_name}`) &&
        (slug(f.field_name) === s || slug(f.field_label) === s),
    );
    if (custom) {
      map[index] = `cf:${custom.field_name}`;
      used.add(`cf:${custom.field_name}`);
      return;
    }

    map[index] = CSV_IGNORE;
  });

  return map;
}

// ---------------------------------------------
// Normalizadores
// ---------------------------------------------

/** Núcleo comparável do telefone (sem DDI 55 e sem o nono dígito). */
export function phoneCore(raw: string | null | undefined): string {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  if (d.length === 11 && d[2] === '9') d = d.slice(0, 2) + d.slice(3);
  return d;
}

export function parseValue(raw: string): { value: number; warning?: string } {
  const cleaned = String(raw ?? '')
    .replace(/[R$\s]/gi, '')
    .trim();
  if (!cleaned) return { value: 0 };

  // "1.234,56" (BR) vs "1234.56" (US)
  let normalized = cleaned;
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');
  if (hasComma && hasDot) {
    normalized = cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '');
  } else if (hasComma) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  }

  const n = Number(normalized);
  if (!Number.isFinite(n)) return { value: 0, warning: `valor inválido ("${raw}")` };
  return { value: n };
}

const PRIORITY_MAP: Record<string, DealPriority> = {
  baixa: 'low',
  low: 'low',
  media: 'medium',
  media_: 'medium',
  medium: 'medium',
  normal: 'medium',
  alta: 'high',
  high: 'high',
  urgente: 'urgent',
  urgent: 'urgent',
  critica: 'urgent',
};

export function parsePriority(raw: string): { value: DealPriority; warning?: string } {
  const s = slug(raw);
  if (!s) return { value: 'medium' };
  const found = PRIORITY_MAP[s];
  if (!found) return { value: 'medium', warning: `prioridade desconhecida ("${raw}")` };
  return { value: found };
}

/** Aceita dd/mm/aaaa, dd-mm-aaaa e aaaa-mm-dd. Devolve ISO (aaaa-mm-dd). */
export function parseDate(raw: string): { value: string | null; warning?: string } {
  const s = String(raw ?? '').trim();
  if (!s) return { value: null };
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return { value: `${iso[1]}-${iso[2]}-${iso[3]}` };
  const br = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (br) {
    const day = br[1].padStart(2, '0');
    const month = br[2].padStart(2, '0');
    const year = br[3].length === 2 ? `20${br[3]}` : br[3];
    const d = new Date(`${year}-${month}-${day}T12:00:00`);
    if (!Number.isNaN(d.getTime())) return { value: `${year}-${month}-${day}` };
  }
  return { value: null, warning: `data inválida ("${raw}")` };
}

export function parseTags(raw: string): string[] {
  return String(raw ?? '')
    .split(/[,;|]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function parseCustomValue(
  field: CRMCustomField,
  raw: string,
): { value: unknown; warning?: string } {
  const s = String(raw ?? '').trim();
  if (!s) return { value: undefined };

  switch (field.field_type) {
    case 'number': {
      const { value, warning } = parseValue(s);
      return warning ? { value: undefined, warning: `${field.field_label}: ${warning}` } : { value };
    }
    case 'date': {
      const { value, warning } = parseDate(s);
      return warning ? { value: undefined, warning: `${field.field_label}: ${warning}` } : { value };
    }
    case 'checkbox': {
      const truthy = ['1', 'true', 'sim', 's', 'yes', 'y', 'x'];
      return { value: truthy.includes(s.toLowerCase()) };
    }
    case 'select': {
      const opt = (field.options || []).find(
        (o) => slug(o.value) === slug(s) || slug(o.label) === slug(s),
      );
      if (!opt) return { value: undefined, warning: `${field.field_label}: opção inválida ("${s}")` };
      return { value: opt.value };
    }
    case 'multiselect': {
      const parts = parseTags(s);
      const values: string[] = [];
      const invalid: string[] = [];
      parts.forEach((p) => {
        const opt = (field.options || []).find(
          (o) => slug(o.value) === slug(p) || slug(o.label) === slug(p),
        );
        if (opt) values.push(opt.value);
        else invalid.push(p);
      });
      return {
        value: values.length > 0 ? values : undefined,
        warning: invalid.length > 0 ? `${field.field_label}: opções inválidas (${invalid.join(', ')})` : undefined,
      };
    }
    default:
      return { value: s };
  }
}

// ---------------------------------------------
// Validação das linhas
// ---------------------------------------------

export interface ImportRowData {
  title: string;
  description?: string;
  value: number;
  priority: DealPriority;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  tags: string[];
  assigned_to?: string;
  expected_close_date?: string | null;
  custom_fields: Record<string, unknown>;
}

export type ImportRowStatus = 'valid' | 'invalid' | 'duplicate';

export interface ImportRow {
  /** Linha no arquivo (1 = primeira linha de dados). */
  line: number;
  status: ImportRowStatus;
  data: ImportRowData;
  errors: string[];
  warnings: string[];
  /** Motivo da duplicidade, quando aplicável. */
  duplicateOf?: string;
}

export interface ValidateOptions {
  headers: string[];
  rows: string[][];
  mapping: Record<number, string>;
  customFields: CRMCustomField[];
  /** Cards já existentes no quadro, para checagem de duplicidade. */
  existing: { contact_phone?: string | null; contact_email?: string | null }[];
  skipDuplicates: boolean;
}

export interface ValidateResult {
  rows: ImportRow[];
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
}

export function validateRows({
  rows,
  mapping,
  customFields,
  existing,
  skipDuplicates,
}: ValidateOptions): ValidateResult {
  const existingPhones = new Set(
    existing.map((d) => phoneCore(d.contact_phone)).filter((p) => p.length > 0),
  );
  const existingEmails = new Set(
    existing
      .map((d) => (d.contact_email || '').trim().toLowerCase())
      .filter((e) => e.length > 0),
  );

  const seenPhones = new Set<string>();
  const seenEmails = new Set<string>();
  const customByName = new Map(customFields.map((f) => [f.field_name, f]));

  const result: ImportRow[] = rows.map((cells, i) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const custom: Record<string, unknown> = {};
    const get = (field: string): string => {
      const idx = Object.entries(mapping).find(([, v]) => v === field)?.[0];
      return idx === undefined ? '' : (cells[Number(idx)] ?? '').trim();
    };

    // Campos adicionais (podem ter mais de um mapeado)
    Object.entries(mapping).forEach(([idxStr, target]) => {
      if (!target.startsWith('cf:')) return;
      const field = customByName.get(target.slice(3));
      if (!field) return;
      const rawCell = (cells[Number(idxStr)] ?? '').trim();
      const { value, warning } = parseCustomValue(field, rawCell);
      if (warning) warnings.push(warning);
      if (value !== undefined) custom[field.field_name] = value;
    });

    const contactName = get('nome');
    let title = get('titulo');
    if (!title) title = contactName;
    if (!title) errors.push('sem título e sem nome do contato');

    const { value, warning: valueWarning } = parseValue(get('valor'));
    if (valueWarning) warnings.push(valueWarning);

    const { value: priority, warning: prioWarning } = parsePriority(get('prioridade'));
    if (prioWarning) warnings.push(prioWarning);

    const { value: expected, warning: dateWarning } = parseDate(get('data_prevista'));
    if (dateWarning) warnings.push(dateWarning);

    const rawPhone = get('telefone').replace(/\D/g, '');
    const email = get('email').trim();
    const core = phoneCore(rawPhone);
    const emailKey = email.toLowerCase();

    // Campos adicionais obrigatórios
    customFields
      .filter((f) => f.is_required)
      .forEach((f) => {
        if (custom[f.field_name] === undefined || custom[f.field_name] === '') {
          errors.push(`campo obrigatório "${f.field_label}" vazio`);
        }
      });

    let status: ImportRowStatus = errors.length > 0 ? 'invalid' : 'valid';
    let duplicateOf: string | undefined;

    if (status === 'valid' && skipDuplicates) {
      if (core && (existingPhones.has(core) || seenPhones.has(core))) {
        status = 'duplicate';
        duplicateOf = `telefone ${rawPhone}`;
      } else if (emailKey && (existingEmails.has(emailKey) || seenEmails.has(emailKey))) {
        status = 'duplicate';
        duplicateOf = `e-mail ${email}`;
      }
    }

    if (status === 'valid') {
      if (core) seenPhones.add(core);
      if (emailKey) seenEmails.add(emailKey);
    }

    return {
      line: i + 1,
      status,
      errors,
      warnings,
      duplicateOf,
      data: {
        title,
        description: get('descricao') || undefined,
        value,
        priority,
        contact_name: contactName || undefined,
        contact_phone: rawPhone || undefined,
        contact_email: email || undefined,
        tags: parseTags(get('tags')),
        assigned_to: get('responsavel') || undefined,
        expected_close_date: expected,
        custom_fields: custom,
      },
    };
  });

  return {
    rows: result,
    validCount: result.filter((r) => r.status === 'valid').length,
    invalidCount: result.filter((r) => r.status === 'invalid').length,
    duplicateCount: result.filter((r) => r.status === 'duplicate').length,
  };
}

// ---------------------------------------------
// Arquivos gerados (modelo e relatório de erros)
// ---------------------------------------------

function csvCell(v: string): string {
  return /[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function downloadCsv(filename: string, lines: string[][]) {
  const content = `\uFEFF${lines.map((l) => l.map(csvCell).join(';')).join('\n')}`;
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function buildTemplateCsv(customFields: CRMCustomField[]): string[][] {
  const headers = [
    ...DEAL_CSV_FIELDS.map((f) => f.key),
    ...customFields.filter((f) => f.is_visible).map((f) => f.field_name),
  ];
  const example = [
    'Contrato Silva & Associados',
    'Lead vindo de indicação',
    '1.500,00',
    'alta',
    'Maria Silva',
    '34991633679',
    'maria@exemplo.com',
    'vip, retorno',
    '',
    '31/12/2026',
    ...customFields.filter((f) => f.is_visible).map(() => ''),
  ];
  return [headers, example];
}

export function buildErrorsCsv(rows: ImportRow[]): string[][] {
  const lines: string[][] = [['linha', 'situacao', 'titulo', 'telefone', 'motivo']];
  rows
    .filter((r) => r.status !== 'valid')
    .forEach((r) => {
      lines.push([
        String(r.line),
        r.status === 'duplicate' ? 'duplicada' : 'invalida',
        r.data.title || '',
        r.data.contact_phone || '',
        r.status === 'duplicate' ? (r.duplicateOf || 'duplicada') : r.errors.join('; '),
      ]);
    });
  return lines;
}
