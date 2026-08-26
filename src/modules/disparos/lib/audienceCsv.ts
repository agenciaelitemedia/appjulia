// =============================================
// Público (audiências) — importação por CSV + validação de WhatsApp BR
// Sem dependência externa; usa o parser do CRM Builder via extend/csv.
// =============================================
import { parseCsv, CSV_IGNORE } from '../extend/csv';
import { normalizeBrPhone } from '../extend/phone';

export const AUDIENCE_CSV_MAX_ROWS = 20000;

/** Campos do contato de público que podem ser preenchidos pelo CSV. */
export type AudienceCsvField =
  | 'nome'
  | 'primeiro_nome'
  | 'whatsapp'
  | 'email'
  | 'documento'
  | 'empresa'
  | 'cidade'
  | 'uf'
  | 'var1'
  | 'var2'
  | 'var3';

export const AUDIENCE_CSV_FIELDS: { key: AudienceCsvField; label: string; aliases: string[] }[] = [
  { key: 'whatsapp', label: 'WhatsApp (obrigatório)', aliases: ['whatsapp', 'telefone', 'phone', 'celular', 'fone', 'numero', 'número', 'wpp', 'zap'] },
  { key: 'nome', label: 'Nome completo', aliases: ['nome', 'name', 'contato', 'cliente', 'lead', 'nome_completo'] },
  { key: 'primeiro_nome', label: 'Primeiro nome', aliases: ['primeiro_nome', 'primeiro nome', 'first_name', 'firstname', 'apelido'] },
  { key: 'email', label: 'E-mail', aliases: ['email', 'e-mail', 'mail'] },
  { key: 'documento', label: 'CPF/CNPJ', aliases: ['documento', 'cpf', 'cnpj', 'doc', 'cpf_cnpj'] },
  { key: 'empresa', label: 'Empresa', aliases: ['empresa', 'company', 'escritorio', 'escritório', 'business'] },
  { key: 'cidade', label: 'Cidade', aliases: ['cidade', 'city', 'municipio', 'município'] },
  { key: 'uf', label: 'UF', aliases: ['uf', 'estado', 'state'] },
  { key: 'var1', label: 'Variável 1', aliases: ['var1', 'variavel1', 'campo1'] },
  { key: 'var2', label: 'Variável 2', aliases: ['var2', 'variavel2', 'campo2'] },
  { key: 'var3', label: 'Variável 3', aliases: ['var3', 'variavel3', 'campo3'] },
];

export { parseCsv, CSV_IGNORE };

const VALID_DDD = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

export interface PhoneCheck {
  ok: boolean;
  phone: string;
  reason?: string;
}

/**
 * Valida e normaliza um WhatsApp brasileiro.
 * Aceita apenas celulares: 13 dígitos (55+DDD+9+8) ou 12 dígitos com
 * primeiro dígito local entre 6 e 9 (DDDs que ainda não usam o 9º).
 */
export function validateWhatsappBr(raw: string | null | undefined): PhoneCheck {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return { ok: false, phone: '', reason: 'Vazio' };

  const phone = normalizeBrPhone(digits.startsWith('55') ? digits : `55${digits}`);
  if (!phone.startsWith('55')) return { ok: false, phone, reason: 'Não é número do Brasil' };
  if (phone.length !== 12 && phone.length !== 13) {
    return { ok: false, phone, reason: `Quantidade de dígitos inválida (${phone.length})` };
  }

  const ddd = parseInt(phone.slice(2, 4), 10);
  if (!VALID_DDD.has(ddd)) return { ok: false, phone, reason: `DDD inválido (${phone.slice(2, 4)})` };

  const local = phone.slice(4);
  const first = local[0];
  if (phone.length === 13) {
    if (first !== '9') return { ok: false, phone, reason: 'Celular deve começar com 9' };
  } else if (!['6', '7', '8', '9'].includes(first)) {
    return { ok: false, phone, reason: 'Número fixo não é aceito no WhatsApp' };
  }
  if (/^(\d)\1+$/.test(local)) return { ok: false, phone, reason: 'Número repetitivo' };

  return { ok: true, phone };
}

/** Deriva o primeiro nome a partir do nome completo. */
export function firstNameOf(fullName: string | null | undefined): string {
  const clean = String(fullName ?? '').trim().replace(/\s+/g, ' ');
  if (!clean) return '';
  const part = clean.split(' ')[0];
  if (part.length <= 2 && clean.split(' ').length > 1) return clean.split(' ').slice(0, 2).join(' ');
  return part;
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/** Mapeia automaticamente os cabeçalhos da planilha para os campos do público. */
export function autoMapAudienceHeaders(headers: string[]): Record<number, AudienceCsvField | typeof CSV_IGNORE> {
  const map: Record<number, AudienceCsvField | typeof CSV_IGNORE> = {};
  const used = new Set<string>();
  headers.forEach((h, idx) => {
    const key = norm(h);
    const found = AUDIENCE_CSV_FIELDS.find(
      (f) => !used.has(f.key) && (norm(f.key) === key || f.aliases.some((a) => norm(a) === key)),
    );
    if (found) {
      map[idx] = found.key;
      used.add(found.key);
    } else {
      map[idx] = CSV_IGNORE;
    }
  });
  return map;
}

export interface AudienceCsvRow {
  index: number;
  name: string;
  first_name: string;
  phone: string;
  email: string | null;
  variables: Record<string, string>;
  valid: boolean;
  error?: string;
  duplicate?: boolean;
}

export interface AudienceCsvResult {
  rows: AudienceCsvRow[];
  valid: AudienceCsvRow[];
  invalid: AudienceCsvRow[];
  duplicates: number;
  truncated: boolean;
}

const VAR_KEYS: AudienceCsvField[] = ['documento', 'empresa', 'cidade', 'uf', 'var1', 'var2', 'var3'];

/** Valida as linhas do CSV aplicando o mapeamento escolhido pelo usuário. */
export function validateAudienceCsv(
  parsed: { headers: string[]; rows: string[][]; truncated?: boolean },
  mapping: Record<number, AudienceCsvField | typeof CSV_IGNORE>,
): AudienceCsvResult {
  const colOf = (field: AudienceCsvField): number =>
    Number(Object.keys(mapping).find((k) => mapping[Number(k)] === field) ?? -1);

  const cPhone = colOf('whatsapp');
  const cName = colOf('nome');
  const cFirst = colOf('primeiro_nome');
  const cEmail = colOf('email');

  const seen = new Set<string>();
  const rows: AudienceCsvRow[] = [];
  let duplicates = 0;

  parsed.rows.slice(0, AUDIENCE_CSV_MAX_ROWS).forEach((cells, i) => {
    const rawPhone = cPhone >= 0 ? (cells[cPhone] ?? '') : '';
    const name = (cName >= 0 ? cells[cName] : '')?.trim() ?? '';
    const firstName = (cFirst >= 0 ? cells[cFirst] : '')?.trim() || firstNameOf(name);
    const email = (cEmail >= 0 ? cells[cEmail] : '')?.trim() || null;

    const variables: Record<string, string> = {};
    VAR_KEYS.forEach((k) => {
      const c = colOf(k);
      if (c >= 0 && (cells[c] ?? '').trim()) variables[k] = cells[c].trim();
    });

    const check = validateWhatsappBr(rawPhone);
    const row: AudienceCsvRow = {
      index: i + 2,
      name,
      first_name: firstName,
      phone: check.phone,
      email,
      variables,
      valid: check.ok,
      error: check.ok ? undefined : check.reason,
    };
    if (check.ok) {
      if (seen.has(check.phone)) {
        row.valid = false;
        row.duplicate = true;
        row.error = 'Duplicado na planilha';
        duplicates += 1;
      } else {
        seen.add(check.phone);
      }
    }
    rows.push(row);
  });

  return {
    rows,
    valid: rows.filter((r) => r.valid),
    invalid: rows.filter((r) => !r.valid),
    duplicates,
    truncated: Boolean(parsed.truncated) || parsed.rows.length > AUDIENCE_CSV_MAX_ROWS,
  };
}

export function buildAudienceTemplateCsv(): string[][] {
  return [
    ['nome', 'whatsapp', 'email', 'cidade', 'uf'],
    ['Maria Souza', '5511987654321', 'maria@exemplo.com', 'São Paulo', 'SP'],
  ];
}
