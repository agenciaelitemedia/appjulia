export interface JuliaFiltersState {
  search: string;
  agentCodes: string[];
  dateFrom: string;
  dateTo: string;
  perfilAgent?: 'SDR' | 'CLOSER' | 'ALL';
  statusDocument?: string;
}

export interface JuliaSessao {
  cod_agent: string;
  agent_id: number;
  name: string;
  business_name: string;
  client_id: number;
  perfil_agent: string;
  session_id: number;
  total_msg: number;
  whatsapp: string;
  status_document: string | null;
  max_created_at: string;
  created_at: string;
}

export interface JuliaContrato {
  cod_agent: string;
  agent_id: number;
  name: string;
  business_name: string;
  client_id: number;
  perfil_agent: string;
  session_id: number;
  total_msg: number;
  whatsapp: string;
  cod_document: string;
  /**
   * Token do documento no ZapSign (doc_token). Esse é o identificador correto
   * para chamar GET /api/v1/docs/{doc_token}/.
   */
  zapsing_doctoken?: string | null;
  status_document: string;
  situacao: string;
  data_contrato: string;
  data_assinatura: string | null;
  resumo_do_caso: string | null;
  signer_name: string | null;
  signer_cpf: string | null;
  signer_uf: string | null;
  signer_cidade: string | null;
  signer_bairro: string | null;
  signer_endereco: string | null;
  signer_cep: string | null;
  case_title: string | null;
  case_category_name: string | null;
  case_category_color: string | null;
  is_confirm: string;
}

export interface JuliaSummary {
  totalSessoes: number;
  totalMensagens: number;
  mediaMsg: number;
  sessoesHoje: number;
}

export interface JuliaContratoSummary {
  totalContratos: number;
  contratosAssinados: number;
  contratosEmCurso: number;
  taxaAssinatura: number;
}

export interface JuliaAgent {
  cod_agent: string;
  owner_name: string;
  owner_business_name?: string;
}
