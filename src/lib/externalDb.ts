import { supabase } from "@/integrations/supabase/client";
import type { Module, UserPermission, PermissionUpdate, UserWithPermissions } from "@/types/permissions";

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
    const startTime = performance.now();
    
    try {
      // Retry transient edge runtime errors (503/boot/cold start) with exponential backoff + jitter
      let data: any = null;
      let error: any = null;
      const maxAttempts = 5;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const res = await supabase.functions.invoke('db-query', { body: payload });
        data = res.data;
        error = res.error;

        // Try to read status code from FunctionsHttpError context if present
        const status =
          (error as any)?.context?.status ??
          (error as any)?.status ??
          undefined;
        const msg = `${error?.message || ''} ${data?.code || ''} ${data?.message || ''}`;
        const isTransient =
          !!error &&
          (status === 503 ||
            status === 502 ||
            status === 504 ||
            /\b50[234]\b|temporarily unavailable|SUPABASE_EDGE_RUNTIME_ERROR|Failed to fetch|NetworkError|TypeError: fetch/i.test(msg));

        if (!isTransient) break;
        if (attempt === maxAttempts) {
          console.warn(`[externalDb] db-query falhou após ${maxAttempts} tentativas`, { action: payload.action, status, msg });
          break;
        }
        // Exponential backoff with jitter: ~300ms, 600ms, 1.2s, 2.4s (cap 5s) + 0-250ms jitter
        const base = Math.min(300 * Math.pow(2, attempt - 1), 5000);
        const jitter = Math.floor(Math.random() * 250);
        const delay = base + jitter;
        console.info(`[externalDb] retry ${attempt}/${maxAttempts - 1} em ${delay}ms (action=${payload.action})`);
        await new Promise((r) => setTimeout(r, delay));
      }

      const duration = performance.now() - startTime;
      
      // Emit debug event if debugbar is enabled
      if ((window as any).__DEBUG_ENABLED__) {
        window.dispatchEvent(new CustomEvent('debug:query', {
          detail: {
            action: payload.action,
            query: payload.data?.query,
            params: payload.data?.params || Object.values(payload.data || {}),
            duration,
            result: data?.data,
            error: error?.message || data?.error
          }
        }));
      }

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      return data.data;
    } catch (err) {
      const duration = performance.now() - startTime;
      
      // Emit debug event for errors
      if ((window as any).__DEBUG_ENABLED__) {
        window.dispatchEvent(new CustomEvent('debug:query', {
          detail: {
            action: payload.action,
            query: payload.data?.query,
            params: payload.data?.params || Object.values(payload.data || {}),
            duration,
            error: err instanceof Error ? err.message : String(err)
          }
        }));
      }
      
      throw err;
    }
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

  async searchAgents<T = any>(term: string): Promise<T[]> {
    return this.invoke({
      action: 'search_agents',
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

  async getAgentsList<T = any>(showLegacy: boolean = false, showAll: boolean = false): Promise<T[]> {
    return this.invoke({
      action: 'get_agents_list',
      data: { showLegacy, showAll },
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

  async insertUserAgent(userId: number, agentId: number | null, codAgent: string): Promise<void> {
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

  async getEffectiveClientId(userId: number): Promise<string | null> {
    try {
      const result = await this.invoke({
        action: 'get_effective_client_id',
        data: { userId },
      }) as Array<{ client_id: string | null }> | null;
      return result?.[0]?.client_id ? String(result[0].client_id) : null;
    } catch (e) {
      console.warn('[externalDb] getEffectiveClientId failed', e);
      return null;
    }
  }

  async createVwEquipe(): Promise<{ success: boolean; message: string }> {
    const result = await this.invoke({ action: 'create_vw_equipe', data: {} });
    return result[0];
  }

  async getTeamByClient<T = any>(userId: number, role: string): Promise<T[]> {
    return this.invoke({
      action: 'get_team_by_client',
      data: { userId, role },
    });
  }

  // === Team Members Methods ===

  async getTeamMembers<T = any>(userId: number, isAdmin: boolean): Promise<T[]> {
    return this.invoke({
      action: 'get_team_members',
      data: { userId, isAdmin },
    });
  }

  async getTeamForAgent<T = any>(codAgent: string): Promise<T[]> {
    return this.invoke({
      action: 'get_team_for_agent',
      data: { codAgent },
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
    agentIds: { agentId: number | null; codAgent: string }[];
    modulePermissions?: { moduleCode: string }[];
    role?: string;
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
    agentIds: { agentId: number | null; codAgent: string }[];
    modulePermissions?: { moduleCode: string }[];
    role?: string;
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

  async updateAgentWabaConnection(
    agentId: number,
    wabaId: string,
    wabaToken: string,
    wabaNumberId: string
  ): Promise<void> {
    await this.invoke({
      action: 'update_agent_waba_connection',
      data: { agentId, wabaId, wabaToken, wabaNumberId },
    });
  }

  async clearAgentWabaConnection(agentId: number): Promise<void> {
    await this.invoke({
      action: 'clear_agent_waba_connection',
      data: { agentId },
    });
  }

  async getAgentWabaStatus(agentId: number): Promise<{ hub: string | null; waba_id: string | null; waba_configured: boolean }> {
    const result = await this.invoke({
      action: 'get_agent_waba_status',
      data: { agentId },
    });
    return result[0];
  }

  async getCrmAgentsForUser<T = any>(userId: number): Promise<T[]> {
    return this.invoke({
      action: 'get_crm_agents_for_user',
      data: { userId },
    });
  }

  // === Permission System Methods ===

  async initPermissionSystem(): Promise<{ success: boolean; message: string }> {
    const result = await this.invoke({
      action: 'init_permission_system',
      data: {},
    });
    return result[0];
  }

  async getUserPermissions(userId: number): Promise<UserPermission[]> {
    return this.invoke({
      action: 'get_user_permissions',
      data: { userId },
    });
  }

  async getModules(): Promise<Module[]> {
    return this.invoke({
      action: 'get_modules',
      data: {},
    });
  }

  async getMenuModules(): Promise<Module[]> {
    return this.invoke({
      action: 'get_menu_modules',
      data: {},
    });
  }

  async createModule(moduleData: Partial<Module>): Promise<Module> {
    const result = await this.invoke({
      action: 'create_module',
      data: { moduleData },
    });
    return result[0];
  }

  async ensureAdvModule(): Promise<void> {
    await this.invoke({
      action: 'ensure_adv_module',
      data: {},
    });
  }

  async updateModule(moduleId: number, moduleData: Partial<Module>): Promise<Module> {
    const result = await this.invoke({
      action: 'update_module',
      data: { moduleId, moduleData },
    });
    return result[0];
  }

  async deleteModule(moduleId: number): Promise<void> {
    await this.invoke({
      action: 'delete_module',
      data: { moduleId },
    });
  }

  async migrateModulesSchema(): Promise<{ success: boolean; message: string }> {
    const result = await this.invoke({
      action: 'migrate_modules_schema',
      data: {},
    });
    return result[0];
  }

  // ─── Queue Access (permissões por fila) ──────────────────────
  async initQueueAccessSystem(): Promise<void> {
    await this.invoke({ action: 'init_queue_access_system', data: {} });
  }

  async getUserQueueAccess(userId: number): Promise<{ queue_access: 'all' | 'specific'; queue_ids: string[] }> {
    const r = await this.invoke({ action: 'get_user_queue_access', data: { user_id: userId } });
    return r[0] || { queue_access: 'all', queue_ids: [] };
  }

  async listQueueMembers(queueId: string): Promise<Array<{
    user_id: number; role: string; name: string; email: string; user_role: string;
  }>> {
    return this.invoke({ action: 'list_queue_members', data: { queue_id: queueId } });
  }

  async setQueueMembers(queueId: string, members: Array<{ user_id: number; role?: string }>): Promise<void> {
    await this.invoke({ action: 'set_queue_members', data: { queue_id: queueId, members } });
  }

  async setUserQueues(
    userId: number,
    queueIds: string[],
    queueAccess: 'all' | 'specific',
    role?: string,
  ): Promise<void> {
    await this.invoke({
      action: 'set_user_queues',
      data: { user_id: userId, queue_ids: queueIds, queue_access: queueAccess, role },
    });
  }

  async listAssignableUsers(clientId: string): Promise<Array<{
    id: number; name: string; email: string; role: string; queue_access: 'all' | 'specific';
  }>> {
    return this.invoke({ action: 'list_assignable_users', data: { client_id: clientId } });
  }

  async listUsersForQueue(clientId: string, queueId: string): Promise<Array<{ id: number }>> {
    return this.invoke({
      action: 'list_users_for_queue',
      data: { client_id: clientId, queue_id: queueId },
    });
  }

  // ─── Module Embeds ───────────────────────────────────────────
  async initEmbedSystem(): Promise<void> {
    await this.invoke({ action: 'init_embed_system', data: {} });
  }

  async listModuleEmbeds(): Promise<any[]> {
    return this.invoke({ action: 'list_module_embeds', data: {} });
  }

  async upsertModuleEmbed(embed: Record<string, any>): Promise<{ module_id: number; ok: boolean }> {
    const r = await this.invoke({ action: 'upsert_module_embed', data: { embed } });
    return r[0];
  }

  async deleteModuleEmbed(moduleId: number): Promise<void> {
    await this.invoke({ action: 'delete_module_embed', data: { module_id: moduleId } });
  }

  async resolveModuleEmbed(moduleCode: string, userId: number): Promise<{
    url: string;
    open_in_new_tab: boolean;
    iframe_sandbox: string;
    iframe_referrer_policy: string;
    name: string;
  }> {
    const r = await this.invoke({
      action: 'resolve_module_embed',
      data: { module_code: moduleCode, user_id: userId },
    });
    return r[0];
  }

  async getRoleDefaultPermissions(role: string): Promise<UserPermission[]> {
    return this.invoke({
      action: 'get_role_default_permissions',
      data: { role },
    });
  }

  async updateUserPermissions(
    userId: number,
    permissions: PermissionUpdate[],
    useCustom: boolean
  ): Promise<{ success: boolean }> {
    const result = await this.invoke({
      action: 'update_user_permissions',
      data: { userId, permissions, useCustom },
    });
    return result[0];
  }

  async updateRoleDefaultPermissions(
    role: string,
    permissions: PermissionUpdate[]
  ): Promise<{ success: boolean }> {
    const result = await this.invoke({
      action: 'update_role_default_permissions',
      data: { role, permissions },
    });
    return result[0];
  }

  async syncRolePermissions(): Promise<{ success: boolean; message: string }> {
    const result = await this.invoke({
      action: 'sync_role_permissions',
      data: {},
    });
    return result[0];
  }

  async getUsersWithPermissions(roleFilter?: string): Promise<UserWithPermissions[]> {
    return this.invoke({
      action: 'get_users_with_permissions',
      data: { roleFilter },
    });
  }

  async checkPermission(
    userId: number,
    moduleCode: string,
    permissionType: 'view' | 'create' | 'edit' | 'delete' = 'view'
  ): Promise<boolean> {
    const result = await this.invoke({
      action: 'check_permission',
      data: { userId, moduleCode, permissionType },
    });
    return result[0]?.has_permission ?? false;
  }

  async updateUserProfile(
    userId: number,
    profileData: { name: string; email: string; role: string; isActive: boolean }
  ): Promise<UserWithPermissions> {
    const result = await this.invoke({
      action: 'update_user_profile',
      data: { userId, ...profileData },
    });
    return result[0];
  }

  async getAvailableAgentsForUser<T = any>(userId: number): Promise<T[]> {
    return this.invoke({
      action: 'get_available_agents_for_user',
      data: { userId },
    });
  }

  async deleteUserAgent(userId: number, codAgent: string): Promise<void> {
    await this.invoke({
      action: 'delete_user_agent',
      data: { userId, codAgent },
    });
  }

  async updateUserAgentOwnership(userId: number, codAgent: string, agentId: number | null): Promise<void> {
    await this.invoke({
      action: 'update_user_agent_ownership',
      data: { userId, codAgent, agentId },
    });
  }

  async updateUserAgentPermissions(userId: number, codAgent: string, canEditPrompt: boolean, canEditConfig: boolean): Promise<void> {
    await this.invoke({
      action: 'update_user_agent_permissions',
      data: { userId, codAgent, canEditPrompt, canEditConfig },
    });
  }

  async updateAgentByOwner(userId: number, codAgent: string, settings?: string, prompt?: string): Promise<void> {
    await this.invoke({
      action: 'update_agent_by_owner',
      data: { userId, codAgent, settings, prompt },
    });
  }

  async migrateUserAgentsPermissions(): Promise<{ success: boolean; message: string }> {
    const result = await this.invoke({
      action: 'migrate_user_agents_permissions',
      data: {},
    });
    return result[0];
  }

  async getSessionStatus(whatsappNumber: string, codAgent: string): Promise<SessionStatus | null> {
    const result = await this.invoke({
      action: 'get_session_status',
      data: { whatsappNumber, codAgent },
    });
    return result.length > 0 ? result[0] : null;
  }

  async getInactiveSessions(agentCodes: string[]): Promise<InactiveSession[]> {
    return this.invoke({
      action: 'get_inactive_sessions',
      data: { agentCodes },
    });
  }

  async updateSessionStatus(sessionId: number, active: boolean): Promise<void> {
    await this.invoke({
      action: 'update_session_status',
      data: { sessionId, active },
    });
  }

  async createManualSession(whatsappNumber: string, codAgent: string): Promise<void> {
    await this.invoke({
      action: 'create_manual_session',
      data: { whatsappNumber, codAgent },
    });
  }

  async getSessionStatusesBatch(
    pairs: { whatsappNumber: string; codAgent: string }[]
  ): Promise<{ whatsapp_number: string; cod_agent: string; active: boolean }[]> {
    if (!pairs || pairs.length === 0) return [];
    return this.invoke({
      action: 'get_session_statuses_batch',
      data: { pairs },
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
  user_id: number;
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

export interface SessionStatus {
  id: number;
  active: boolean;
  whatsapp_number: string;
  cod_agent: string;
  created_at: string;
  updated_at: string;
}

export interface InactiveSession {
  id: number;
  whatsapp_number: string;
  active: boolean;
  created_at: string;
  updated_at: string;
  cod_agent: string;
  contact_name: string | null;
  business_name: string | null;
  card_id: number | null;
  stage_id: number | null;
  stage_name: string | null;
  stage_color: string | null;
  owner_name: string | null;
}

export const externalDb = new ExternalDatabase();
