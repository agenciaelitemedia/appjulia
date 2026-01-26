import { useState } from 'react';
import { externalDb, AgentUpdateData } from '@/lib/externalDb';
import { unmask } from '@/lib/inputMasks';
import bcrypt from 'bcryptjs';

interface ClientUpdateData {
  name: string;
  business_name: string | null;
  federal_id: string | null;
  email: string | null;
  phone: string | null;
  zip_code: string | null;
  street: string | null;
  street_number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
}

export function useAgentUpdate() {
  const [isSaving, setIsSaving] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const generateDefaultPassword = (): string => {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    return `Julia@${randomDigits}`;
  };

  const updateClient = async (clientId: number, clientData: ClientUpdateData): Promise<void> => {
    await externalDb.updateClient(clientId, clientData);
  };

  const updateAgent = async (agentId: number, agentData: AgentUpdateData): Promise<void> => {
    await externalDb.updateAgent(agentId, agentData);
  };

  const resetPassword = async (userId: number): Promise<{ success: boolean; newPassword: string | null; error: string | null }> => {
    setIsResettingPassword(true);
    try {
      const newPassword = generateDefaultPassword();
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      await externalDb.resetUserPassword(userId, hashedPassword, newPassword);
      
      return { success: true, newPassword, error: null };
    } catch (error) {
      console.error('Error resetting password:', error);
      return { 
        success: false, 
        newPassword: null, 
        error: error instanceof Error ? error.message : 'Erro ao resetar senha' 
      };
    } finally {
      setIsResettingPassword(false);
    }
  };

  const saveChanges = async (
    agentId: number,
    clientId: number,
    formData: {
      // Agent data
      status: boolean;
      is_closer: boolean;
      config_json: string;
      system_prompt: string;
      plan_id: string;
      lead_limit: number;
      due_day: number;
      // Client data
      client_name: string;
      client_business_name: string;
      client_federal_id: string;
      client_email: string;
      client_phone: string;
      client_zip_code: string;
      client_street: string;
      client_street_number: string;
      client_complement: string;
      client_neighborhood: string;
      client_city: string;
      client_state: string;
    }
  ): Promise<{ success: boolean; error: string | null }> => {
    setIsSaving(true);
    
    try {
      // Validate JSON
      try {
        JSON.parse(formData.config_json);
      } catch {
        return { success: false, error: 'JSON de configurações inválido' };
      }

      // Update client
      await updateClient(clientId, {
        name: formData.client_name,
        business_name: formData.client_business_name || null,
        federal_id: unmask(formData.client_federal_id) || null,
        email: formData.client_email || null,
        phone: unmask(formData.client_phone) || null,
        zip_code: unmask(formData.client_zip_code) || null,
        street: formData.client_street || null,
        street_number: formData.client_street_number || null,
        complement: formData.client_complement || null,
        neighborhood: formData.client_neighborhood || null,
        city: formData.client_city || null,
        state: formData.client_state || null,
      });

      // Update agent
      await updateAgent(agentId, {
        settings: formData.config_json,
        prompt: formData.system_prompt,
        is_closer: formData.is_closer,
        agent_plan_id: parseInt(formData.plan_id),
        due_date: formData.due_day,
        status: formData.status,
      });

      return { success: true, error: null };
    } catch (error) {
      console.error('Error saving changes:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro ao salvar alterações' 
      };
    } finally {
      setIsSaving(false);
    }
  };

  return {
    saveChanges,
    resetPassword,
    isSaving,
    isResettingPassword,
  };
}
