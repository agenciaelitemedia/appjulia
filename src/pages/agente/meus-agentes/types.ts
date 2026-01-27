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
}
