import { useCallback, useState } from 'react';
import bcrypt from 'bcryptjs';
import { unmask } from '@/lib/inputMasks';
import { generateSecurePassword } from '@/lib/crypto';
import { externalDb, supabase } from '../extend/db';
import { ensureChatClientSettings } from '../extend/chat';
import { applyOfficePermissions } from '../extend/permissions';
import type { OfficeFormData } from '../types';

interface SaveOfficeResult {
  success: boolean;
  officeId?: string;
  tempPassword?: string;
  error?: string;
}

export function useOfficeSave() {
  const [isSaving, setIsSaving] = useState(false);

  const rollback = useCallback(
    async (clientId: number | null, userId: number | null, isNewClient: boolean, isNewUser: boolean) => {
      try {
        if (userId && isNewUser) {
          const hasAgents = await externalDb.checkUserHasAgents(userId);
          if (!hasAgents) await externalDb.deleteUser(userId);
        }
        if (clientId && isNewClient) {
          const hasAgents = await externalDb.checkClientHasAgents(clientId);
          if (!hasAgents) await externalDb.deleteClient(clientId);
        }
      } catch (e) {
        console.error('[escritorios] rollback error', e);
      }
    },
    [],
  );

  const saveOffice = useCallback(
    async (data: OfficeFormData, createdBy?: string): Promise<SaveOfficeResult> => {
      setIsSaving(true);

      let clientId: number | null = null;
      let userId: number | null = null;
      let isNewClient = false;
      let isNewUser = false;
      let tempPassword: string | undefined;

      try {
        // === VALIDAÇÕES ===
        if (data.is_new_client) {
          const federalId = unmask(data.federal_id);
          if (federalId) {
            const check = await externalDb.checkFederalIdExists(federalId);
            if (check.exists) return { success: false, error: 'CPF/CNPJ já cadastrado no sistema' };
          }
        }
        if (data.is_new_user) {
          const check = await externalDb.checkUserEmailExists(data.user_email);
          if (check.exists) return { success: false, error: 'E-mail de usuário já cadastrado no sistema' };
        }

        // === CLIENTE (ESCRITÓRIO) ===
        if (data.is_new_client) {
          isNewClient = true;
          const created = await externalDb.insertClient({
            name: data.office_name,
            business_name: data.business_name || null,
            federal_id: unmask(data.federal_id) || null,
            email: data.email || null,
            phone: unmask(data.phone) || null,
            zip_code: unmask(data.zip_code) || null,
            street: data.street || null,
            street_number: data.street_number || null,
            complement: data.complement || null,
            neighborhood: data.neighborhood || null,
            city: data.city || null,
            state: data.state || null,
          } as any);
          clientId = created.id;
        } else {
          clientId = data.client_id;
        }
        if (!clientId) throw new Error('ID do escritório (cliente) não encontrado');

        // === USUÁRIO TITULAR ===
        if (data.is_new_user) {
          isNewUser = true;
          tempPassword = generateSecurePassword();
          const hashed = await bcrypt.hash(tempPassword, 10);
          const created = await externalDb.insertUser(
            data.user_name,
            data.user_email,
            hashed,
            tempPassword,
            clientId,
          );
          userId = created.id;
        } else {
          userId = data.user_id;
        }
        if (!userId) throw new Error('ID do usuário titular não encontrado');

        // === PERMISSÕES DOS MÓDULOS LIBERADOS ===
        await applyOfficePermissions(userId, data.modules);

        // === CONFIGURAÇÃO BASE DE CHAT DO CLIENTE ===
        await ensureChatClientSettings(clientId, data.office_name, data.business_name || null);

        // === REGISTRO DO ESCRITÓRIO ===
        const leadsLimit = data.leads_limit ? Number(data.leads_limit) : null;
        const { data: office, error } = await supabase
          .from('offices')
          .insert({
            client_id: clientId,
            owner_user_id: userId,
            office_name: data.office_name,
            business_name: data.business_name || null,
            federal_id: unmask(data.federal_id) || null,
            email: data.email || null,
            phone: unmask(data.phone) || null,
            owner_name: data.user_name || null,
            owner_email: data.user_email || null,
            plan_id: data.plan_id ? Number(data.plan_id) : null,
            plan_name: null,
            leads_limit: Number.isFinite(leadsLimit as number) ? leadsLimit : null,
            due_day: data.due_day ? Number(data.due_day) : null,
            expires_at: data.expires_at || null,
            modules: data.modules,
            notes: data.notes || null,
            created_by: createdBy || null,
          } as any)
          .select('id')
          .single();
        if (error) throw error;

        return { success: true, officeId: office?.id as string, tempPassword: isNewUser ? tempPassword : undefined };
      } catch (error) {
        console.error('[escritorios] erro ao salvar escritório', error);
        await rollback(clientId, userId, isNewClient, isNewUser);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Erro desconhecido ao salvar escritório',
        };
      } finally {
        setIsSaving(false);
      }
    },
    [rollback],
  );

  return { saveOffice, isSaving };
}