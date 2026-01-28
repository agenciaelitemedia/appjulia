export interface TeamMember {
  id: number;
  name: string;
  email: string;
  user_id: number | null;
  created_at: string;
  agents_count: number;
}

export interface PrincipalUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface PrincipalUserAgent {
  agent_id: number | null;
  cod_agent: string;
  status: boolean;
  business_name: string;
  agent_type: 'own' | 'monitored';
}

export interface TeamMemberFormData {
  name: string;
  email: string;
  principalUserId: number | null;
  selectedAgentIds: number[];
}
