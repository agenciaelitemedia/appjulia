import { useState, useCallback } from 'react';
import { externalDb, AgentInsertData } from '@/lib/externalDb';
import { unmask } from '@/lib/inputMasks';
import { toast } from 'sonner';
import bcrypt from 'bcryptjs';
import type { AgentFormData } from '../components/CreateAgentWizard';

interface SaveResult {
  success: boolean;
  agentId?: number;
  tempPassword?: string;
  error?: string;
}

function generateDefaultPassword(): string {
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `Julia@${digits}`;
}

export function useAgentSave() {
  const [isSaving, setIsSaving] = useState(false);

  const rollback = useCallback(async (
    agentId: number | null,
    userId: number | null,
    clientId: number | null,
    isNewUser: boolean,
    isNewClient: boolean
  ) => {
    console.log('Starting rollback...', { agentId, userId, clientId, isNewUser, isNewClient });
    
    try {
      // 1. Delete agent if created
      if (agentId) {
        console.log('Deleting agent:', agentId);
        await externalDb.deleteAgent(agentId);
      }

      // 2. Delete user if created AND has no other agents
      if (userId && isNewUser) {
        const hasAgents = await externalDb.checkUserHasAgents(userId);
        if (!hasAgents) {
          console.log('Deleting user:', userId);
          await externalDb.deleteUser(userId);
        }
      }

      // 3. Delete client if created AND has no other agents
      if (clientId && isNewClient) {
        const hasAgents = await externalDb.checkClientHasAgents(clientId);
        if (!hasAgents) {
          console.log('Deleting client:', clientId);
          await externalDb.deleteClient(clientId);
        }
      }

      console.log('Rollback completed');
    } catch (rollbackError) {
      console.error('Error during rollback:', rollbackError);
    }
  }, []);

  const saveAgent = useCallback(async (
    data: AgentFormData,
    regenerateCode: () => Promise<string | null>
  ): Promise<SaveResult> => {
    setIsSaving(true);

    let createdClientId: number | null = null;
    let createdUserId: number | null = null;
    let createdAgentId: number | null = null;
    let isNewClient = false;
    let isNewUser = false;
    let tempPassword: string | undefined;

    try {
      // === VALIDATIONS ===
      
      // 1.1 Validate federal_id if new client
      if (data.new_client) {
        const federalId = unmask(data.client_federal_id);
        if (federalId) {
          const fedCheck = await externalDb.checkFederalIdExists(federalId);
          if (fedCheck.exists) {
            return { success: false, error: 'CPF/CNPJ já cadastrado no sistema' };
          }
        }
      }

      // 1.2 Validate email if new user
      if (data.new_user) {
        const emailCheck = await externalDb.checkUserEmailExists(data.user_email);
        if (emailCheck.exists) {
          return { success: false, error: 'E-mail de usuário já cadastrado no sistema' };
        }
      }

      // 1.3 Validate cod_agent
      const codeExists = await externalDb.checkAgentCodeExists(data.cod_agent);
      if (codeExists) {
        // Generate new code
        const newCode = await regenerateCode();
        return { 
          success: false, 
          error: `Código do agente já existe. ${newCode ? `Novo código gerado: ${newCode}` : 'Gere um novo código.'}` 
        };
      }

      // === CREATE CLIENT (if needed) ===
      if (data.new_client) {
        isNewClient = true;
        const clientData = {
          name: data.client_name,
          business_name: data.client_business_name || null,
          federal_id: unmask(data.client_federal_id) || null,
          email: data.client_email || null,
          phone: unmask(data.client_phone) || null,
          zip_code: unmask(data.client_zip_code) || null,
          street: data.client_street || null,
          street_number: data.client_street_number || null,
          complement: data.client_complement || null,
          neighborhood: data.client_neighborhood || null,
          city: data.client_city || null,
          state: data.client_state || null,
        };
        
        console.log('Creating new client:', clientData);
        const clientResult = await externalDb.insertClient(clientData);
        createdClientId = clientResult.id;
        console.log('Client created with ID:', createdClientId);
      } else {
        createdClientId = data.client_id;
      }

      if (!createdClientId) {
        throw new Error('ID do cliente não encontrado');
      }

      // === CREATE USER (if needed) ===
      if (data.new_user) {
        isNewUser = true;
        tempPassword = generateDefaultPassword();
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        
        console.log('Creating new user:', data.user_name, data.user_email);
        const userResult = await externalDb.insertUser(
          data.user_name,
          data.user_email,
          hashedPassword,
          tempPassword
        );
        createdUserId = userResult.id;
        console.log('User created with ID:', createdUserId);
      } else {
        createdUserId = data.user_id;
      }

      if (!createdUserId) {
        throw new Error('ID do usuário não encontrado');
      }

      // === CREATE AGENT ===
      const agentData: AgentInsertData = {
        client_id: createdClientId,
        cod_agent: data.cod_agent,
        settings: data.config_json || '{}',
        prompt: data.system_prompt || '',
        is_closer: data.is_closer,
        agent_plan_id: parseInt(data.plan_id),
        due_date: data.due_day,
      };

      console.log('Creating agent:', agentData);
      const agentResult = await externalDb.insertAgent(agentData);
      createdAgentId = agentResult.id;
      console.log('Agent created with ID:', createdAgentId);

      // === CREATE USER-AGENT LINK ===
      console.log('Creating user-agent link:', createdUserId, createdAgentId);
      await externalDb.insertUserAgent(createdUserId, createdAgentId);
      console.log('User-agent link created');

      return { 
        success: true, 
        agentId: createdAgentId,
        tempPassword: isNewUser ? tempPassword : undefined
      };

    } catch (error) {
      console.error('Error saving agent:', error);
      
      // Rollback
      await rollback(createdAgentId, createdUserId, createdClientId, isNewUser, isNewClient);
      
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao salvar agente';
      return { success: false, error: errorMessage };
    } finally {
      setIsSaving(false);
    }
  }, [rollback]);

  return {
    saveAgent,
    isSaving,
  };
}
