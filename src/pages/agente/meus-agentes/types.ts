export type WhatsAppProvider = 'uazapi' | 'waba' | null;

export interface UserAgent {
  agent_id: number | null;
  cod_agent: string;
  agent_id_from_agents: number | null;
  status: boolean;
  client_name: string | null;
  business_name: string | null;
  plan_name: string | null;
  plan_limit: number | null;
  leads_received: number;
  // Campos de conexão UaZapi
  hub: WhatsAppProvider;
  evo_url: string | null;
  evo_apikey: string | null;
  evo_instancia: string | null;
  // Campos de conexão WABA
  waba_id: string | null;
  waba_number_id: string | null;
  waba_configured: boolean;
  // Permissões de edição
  can_edit_prompt: boolean;
  can_edit_config: boolean;
}

export type ConnectionStatus = 'no_config' | 'connected' | 'disconnected' | 'checking' | 'waba_connected';

export interface CreateInstanceResponse {
  success: boolean;
  instanceName: string;
  token: string;
  error?: string;
}
