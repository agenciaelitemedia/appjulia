/** Catálogo de campos que podem ser exigidos para gerar o contrato. */
export interface XJContractField {
  key: string;
  label?: string;
  validation?: string;
  /** Campo calculado pelo sistema — nunca é pedido ao lead. */
  computed?: boolean;
}

export const XJ_CONTRACT_FIELD_CATALOG: XJContractField[] = [
  { key: 'nome_completo', label: 'Nome Completo', validation: 'texto' },
  { key: 'seu_cpf', label: 'Seu CPF', validation: 'cpf' },
  { key: 'sua_identidade', label: 'Número da sua Identidade (RG)', validation: 'texto' },
  { key: 'seu_endereco', label: 'Seu endereço completo (Rua/Avenida e Número)', validation: 'texto' },
  { key: 'seu_bairro', label: 'Seu Bairro', validation: 'texto' },
  { key: 'sua_cidade', label: 'Sua Cidade', validation: 'texto' },
  { key: 'seu_estado', label: 'Seu Estado (UF)', validation: 'uf' },
  { key: 'seu_cep', label: 'Seu CEP', validation: 'cep' },
  { key: 'seu_email', label: 'Seu e-mail', validation: 'email' },
  { key: 'naturalidade', label: 'Naturalidade', validation: 'texto' },
  { key: 'estado_civil', label: 'Estado Civil', validation: 'texto' },
  { key: 'profissao', label: 'Profissão', validation: 'texto' },
  { key: 'nome_filho', label: 'Nome do Filho', validation: 'texto' },
  { key: 'cpf_filho', label: 'CPF do Filho', validation: 'cpf' },
  { key: 'nascimento_filho', label: 'Data de Nascimento do Filho', validation: 'data' },
];

const CATALOG_KEYS = new Set(XJ_CONTRACT_FIELD_CATALOG.map((f) => f.key));

/**
 * Campos automáticos do sistema, disponíveis apenas no mapeamento de variáveis do
 * ZapSign (não entram na checklist de dados pedidos ao lead).
 */
export const XJ_CONTRACT_SYSTEM_FIELDS: XJContractField[] = [
  { key: 'sys_data_completa', label: 'Data atual completa (Brasília/DF, 10 de agosto de 2026)', computed: true },
  { key: 'sys_data_extenso', label: 'Data atual por extenso (10 de agosto de 2026)', computed: true },
];

const MONTHS_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** Prévia do valor de um campo automático, no fuso de Brasília. */
export function previewSystemField(key: string, now: Date = new Date()): string | null {
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const extenso = `${brt.getUTCDate()} de ${MONTHS_PT[brt.getUTCMonth()]} de ${brt.getUTCFullYear()}`;
  if (key === 'sys_data_completa') return `Brasília/DF, ${extenso}`;
  if (key === 'sys_data_extenso') return extenso;
  return null;
}

export function isSystemContractField(key?: string | null): boolean {
  return !!key && key.startsWith('sys_');
}

/** Campos salvos que não pertencem ao catálogo (criados na tela de Casos). */
export function extraContractFields(fields: XJContractField[] = []): XJContractField[] {
  return fields.filter((f) => f?.key && !CATALOG_KEYS.has(f.key));
}

/**
 * Monta a lista final na ordem do catálogo, mantendo os campos personalizados no fim.
 */
export function buildContractFields(
  selectedKeys: string[],
  saved: XJContractField[] = [],
): XJContractField[] {
  const selected = new Set(selectedKeys);
  const fromCatalog = XJ_CONTRACT_FIELD_CATALOG.filter((f) => selected.has(f.key));
  const extras = extraContractFields(saved).filter((f) => selected.has(f.key));
  return [...fromCatalog, ...extras];
}