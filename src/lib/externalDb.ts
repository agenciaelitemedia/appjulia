import { supabase } from "@/integrations/supabase/client";

interface QueryOptions {
  table: string;
  select?: string;
  where?: Record<string, any>;
  limit?: number;
  offset?: number;
  orderBy?: string;
}

interface MutationOptions {
  table: string;
  data: Record<string, any>;
  where?: Record<string, any>;
}

interface RawQueryOptions {
  query: string;
  params?: any[];
}

class ExternalDatabase {
  private async invoke(payload: Record<string, any>) {
    const { data, error } = await supabase.functions.invoke('db-query', {
      body: payload,
    });

    if (error) throw error;
    if (data.error) throw new Error(data.error);
    
    return data.data;
  }

  async select<T = any>(options: QueryOptions): Promise<T[]> {
    return this.invoke({
      action: 'select',
      ...options,
    });
  }

  async insert<T = any>(options: MutationOptions): Promise<T> {
    return this.invoke({
      action: 'insert',
      table: options.table,
      data: options.data,
    });
  }

  async update<T = any>(options: MutationOptions): Promise<T> {
    if (!options.where) {
      throw new Error('WHERE clause is required for UPDATE operations');
    }
    return this.invoke({
      action: 'update',
      table: options.table,
      data: options.data,
      where: options.where,
    });
  }

  async delete<T = any>(options: { table: string; where: Record<string, any> }): Promise<T> {
    return this.invoke({
      action: 'delete',
      ...options,
    });
  }

  async raw<T = any>(options: RawQueryOptions): Promise<T[]> {
    return this.invoke({
      action: 'raw',
      data: options,
    });
  }

  async login<T = any>(email: string, password: string): Promise<T[]> {
    return this.invoke({
      action: 'login',
      data: { email, password },
    });
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<{ success: boolean }> {
    return this.invoke({
      action: 'change_password',
      data: { userId, currentPassword, newPassword },
    });
  }

  async getClient<T = any>(clientId: number): Promise<T | null> {
    const result = await this.invoke({
      action: 'get_client',
      data: { clientId },
    });
    return result.length > 0 ? result[0] : null;
  }

  async updateClient<T = any>(clientId: number, clientData: Record<string, any>): Promise<T> {
    const result = await this.invoke({
      action: 'update_client',
      data: { clientId, clientData },
    });
    return result[0];
  }

  async searchClients<T = any>(term: string): Promise<T[]> {
    return this.invoke({
      action: 'search_clients',
      data: { term },
    });
  }

  async searchUsers<T = any>(term: string): Promise<T[]> {
    return this.invoke({
      action: 'search_users',
      data: { term },
    });
  }

  async getNextAgentCode(): Promise<string> {
    const result = await this.invoke({
      action: 'get_next_agent_code',
      data: {},
    });
    return result[0].cod_agent;
  }

  async getPlans<T = any>(): Promise<T[]> {
    return this.invoke({
      action: 'get_plans',
      data: {},
    });
  }

  async getAgentsList<T = any>(): Promise<T[]> {
    return this.invoke({
      action: 'get_agents_list',
      data: {},
    });
  }

  async insertClient<T = any>(clientData: Partial<Client>): Promise<T> {
    const result = await this.invoke({
      action: 'insert_client',
      data: { clientData },
    });
    return result[0];
  }

  // === Validation Methods ===
  
  async checkFederalIdExists(federalId: string): Promise<{ exists: boolean; clientId: number | null }> {
    const result = await this.invoke({
      action: 'check_federal_id_exists',
      data: { federalId },
    });
    return result[0];
  }

  async checkUserEmailExists(email: string): Promise<{ exists: boolean; userId: number | null }> {
    const result = await this.invoke({
      action: 'check_user_email_exists',
      data: { email },
    });
    return result[0];
  }

  async checkAgentCodeExists(codAgent: string): Promise<boolean> {
    const result = await this.invoke({
      action: 'check_agent_code_exists',
      data: { codAgent },
    });
    return result[0].exists;
  }

  // === Insert Methods ===
  
  async insertUser(name: string, email: string, hashedPassword: string, rawPassword: string, clientId: number): Promise<{ id: number; name: string; email: string }> {
    const result = await this.invoke({
      action: 'insert_user',
      data: { name, email, hashedPassword, rawPassword, clientId },
    });
    return result[0];
  }

  async insertAgent(agentData: AgentInsertData): Promise<{ id: number }> {
    const result = await this.invoke({
      action: 'insert_agent',
      data: agentData,
    });
    return result[0];
  }

  async insertUserAgent(userId: number, agentId: number, codAgent: string): Promise<void> {
    await this.invoke({
      action: 'insert_user_agent',
      data: { userId, agentId, codAgent },
    });
  }

  // === Delete Methods (for rollback) ===
  
  async deleteAgent(agentId: number): Promise<void> {
    await this.invoke({
      action: 'delete_agent',
      data: { agentId },
    });
  }

  async deleteUser(userId: number): Promise<void> {
    await this.invoke({
      action: 'delete_user',
      data: { userId },
    });
  }

  async deleteClient(clientId: number): Promise<void> {
    await this.invoke({
      action: 'delete_client',
      data: { clientId },
    });
  }

  // === Check Methods (for rollback safety) ===
  
  async checkUserHasAgents(userId: number): Promise<boolean> {
    const result = await this.invoke({
      action: 'check_user_has_agents',
      data: { userId },
    });
    return result[0].hasAgents;
  }

  async checkClientHasAgents(clientId: number): Promise<boolean> {
    const result = await this.invoke({
      action: 'check_client_has_agents',
      data: { clientId },
    });
    return result[0].hasAgents;
  }

  async getAgentDetails<T = any>(agentId: number): Promise<T | null> {
    const result = await this.invoke({
      action: 'get_agent_details',
      data: { agentId },
    });
    return result.length > 0 ? result[0] : null;
  }

  async updateAgent(agentId: number, agentData: AgentUpdateData): Promise<void> {
    await this.invoke({
      action: 'update_agent',
      data: { agentId, agentData },
    });
  }

  async resetUserPassword(userId: number, hashedPassword: string, rawPassword: string): Promise<{ id: number; name: string; email: string }> {
    const result = await this.invoke({
      action: 'reset_user_password',
      data: { userId, hashedPassword, rawPassword },
    });
    return result[0];
  }

  async getUserAgents<T = any>(userId: number): Promise<T[]> {
    return this.invoke({
      action: 'get_user_agents',
      data: { userId },
    });
  }

  // === Team Members Methods ===

  async getTeamMembers<T = any>(userId: number, isAdmin: boolean): Promise<T[]> {
    return this.invoke({
      action: 'get_team_members',
      data: { userId, isAdmin },
    });
  }

  async getPrincipalUsers<T = any>(userId: number, isAdmin: boolean): Promise<T[]> {
    return this.invoke({
      action: 'get_principal_users',
      data: { userId, isAdmin },
    });
  }

  async getUserAgentsForPrincipal<T = any>(principalUserId: number): Promise<T[]> {
    return this.invoke({
      action: 'get_user_agents_for_principal',
      data: { principalUserId },
    });
  }

  async insertTeamMember<T = any>(data: {
    name: string;
    email: string;
    hashedPassword: string;
    rawPassword: string;
    principalUserId: number;
    clientId: number | null;
    agentIds: { agentId: number; codAgent: string }[];
  }): Promise<T> {
    const result = await this.invoke({
      action: 'insert_team_member',
      data,
    });
    return result[0];
  }

  async updateTeamMember(data: {
    memberId: number;
    name: string;
    principalUserId: number;
    agentIds: { agentId: number; codAgent: string }[];
  }): Promise<void> {
    await this.invoke({
      action: 'update_team_member',
      data,
    });
  }

  async deleteTeamMember(memberId: number): Promise<void> {
    await this.invoke({
      action: 'delete_team_member',
      data: { memberId },
    });
  }

  async getTeamMemberAgents<T = any>(memberId: number): Promise<T[]> {
    return this.invoke({
      action: 'get_team_member_agents',
      data: { memberId },
    });
  }

  async resetTeamMemberPassword(memberId: number, hashedPassword: string, rawPassword: string): Promise<void> {
    await this.invoke({
      action: 'reset_team_member_password',
      data: { memberId, hashedPassword, rawPassword },
    });
  }

  async updateAgentConnection(
    agentId: number,
    connectionData: {
      hub: string;
      evo_url: string;
      evo_apikey: string;
      evo_instancia: string;
    }
  ): Promise<void> {
    await this.invoke({
      action: 'update_agent_connection',
      data: { agentId, connectionData },
    });
  }

  async getCrmAgentsForUser<T = any>(userId: number): Promise<T[]> {
    return this.invoke({
      action: 'get_crm_agents_for_user',
      data: { userId },
    });
  }
}

export interface AgentInsertData {
  client_id: number;
  cod_agent: string;
  settings: string;
  prompt: string;
  is_closer: boolean;
  agent_plan_id: number;
  due_date: number;
}

export interface AgentUpdateData {
  settings: string;
  prompt: string;
  is_closer: boolean;
  agent_plan_id: number;
  due_date: number;
  status: boolean;
}

export interface Client {
  id: number;
  name: string | null;
  business_name: string | null;
  federal_id: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  zip_code: string | null;
  street: string | null;
  street_number: string | null;
  complement: string | null;
  neighborhood: string | null;
  photo: string | null;
  created_at?: string;
  updated_at?: string;
}

export const externalDb = new ExternalDatabase();
