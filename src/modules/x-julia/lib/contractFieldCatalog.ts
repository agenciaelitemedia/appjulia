/** Catálogo de campos que podem ser exigidos para gerar o contrato. */
export interface XJContractField {
  key: string;
  label?: string;
  validation?: string;
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
  { key: 'nome_filho', label: 'Nome do Filho', validation: 'texto' },
  { key: 'cpf_filho', label: 'CPF do Filho', validation: 'cpf' },
  { key: 'nascimento_filho', label: 'Data de Nascimento do Filho', validation: 'data' },
];

const CATALOG_KEYS = new Set(XJ_CONTRACT_FIELD_CATALOG.map((f) => f.key));

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