import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { externalDb } from '@/lib/externalDb';
import type { 
  AdvboxIntegration, 
  AdvboxIntegrationFormData,
  AdvboxTestConnectionResult 
} from '@/types/advbox';

interface UseAdvboxIntegrationReturn {
  integration: AdvboxIntegration | null;
  isLoading: boolean;
  isSaving: boolean;
  isTesting: boolean;
  loadIntegration: (codAgent: string) => Promise<void>;
  saveIntegration: (codAgent: string, data: AdvboxIntegrationFormData) => Promise<boolean>;
  testConnection: (apiEndpoint: string, apiToken: string) => Promise<AdvboxTestConnectionResult>;
  deleteIntegration: (integrationId: string) => Promise<boolean>;
}

export function useAdvboxIntegration(): UseAdvboxIntegrationReturn {
  const { toast } = useToast();
  const [integration, setIntegration] = useState<AdvboxIntegration | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const loadIntegration = useCallback(async (agentId: number) => {
    setIsLoading(true);
    try {
      const result = await externalDb.raw<AdvboxIntegration>({
        query: `
          SELECT 
            ai.*,
            (SELECT COUNT(*) FROM advbox_processes_cache apc WHERE apc.agent_id = ai.agent_id) as total_processes_cached,
            (SELECT COUNT(*) FROM advbox_notification_logs anl WHERE anl.agent_id = ai.agent_id AND anl.created_at >= NOW() - INTERVAL '24 hours') as notifications_sent_24h,
            (SELECT COUNT(*) FROM advbox_client_queries acq WHERE acq.agent_id = ai.agent_id AND acq.created_at >= NOW() - INTERVAL '24 hours') as queries_answered_24h
          FROM advbox_integrations ai
          WHERE ai.agent_id = $1
          LIMIT 1
        `,
        params: [agentId],
      });

      setIntegration(result.length > 0 ? result[0] : null);
    } catch (error) {
      console.error('Error loading Advbox integration:', error);
      toast({
        title: 'Erro ao carregar integração',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const testConnection = useCallback(async (
    apiEndpoint: string, 
    apiToken: string
  ): Promise<AdvboxTestConnectionResult> => {
    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('advbox-integration', {
        body: {
          action: 'test',
          apiEndpoint,
          apiToken,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        return {
          success: false,
          message: data.error || 'Falha ao conectar com Advbox',
        };
      }

      return {
        success: true,
        message: 'Conexão estabelecida com sucesso!',
        client_count: data.client_count,
      };
    } catch (error) {
      console.error('Error testing Advbox connection:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao testar conexão',
      };
    } finally {
      setIsTesting(false);
    }
  }, []);

  const saveIntegration = useCallback(async (
    agentId: number, 
    data: AdvboxIntegrationFormData
  ): Promise<boolean> => {
    setIsSaving(true);
    try {
      // First test the connection
      const testResult = await testConnection(data.api_endpoint, data.api_token);
      
      const connectionStatus = testResult.success ? 'connected' : 'error';
      const lastError = testResult.success ? null : testResult.message;

      // Save to database via Edge Function (encrypts token)
      const { data: saveResult, error } = await supabase.functions.invoke('advbox-integration', {
        body: {
          action: 'save',
          agentId,
          apiEndpoint: data.api_endpoint,
          apiToken: data.api_token,
          isActive: data.is_active,
          settings: data.settings,
          connectionStatus,
          lastError,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Erro ao salvar integração');
      }

      // Reload integration data
      await loadIntegration(agentId);

      toast({
        title: testResult.success ? 'Integração salva' : 'Integração salva com erros',
        description: testResult.success 
          ? 'Configuração do Advbox salva com sucesso!'
          : `Configuração salva, mas a conexão falhou: ${testResult.message}`,
        variant: testResult.success ? 'default' : 'destructive',
      });

      return testResult.success;
    } catch (error) {
      console.error('Error saving Advbox integration:', error);
      toast({
        title: 'Erro ao salvar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [testConnection, loadIntegration, toast]);

  const deleteIntegration = useCallback(async (integrationId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('advbox-integration', {
        body: {
          action: 'delete',
          integrationId,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro ao remover integração');
      }

      setIntegration(null);
      toast({
        title: 'Integração removida',
        description: 'A integração com Advbox foi desativada.',
      });
      return true;
    } catch (error) {
      console.error('Error deleting Advbox integration:', error);
      toast({
        title: 'Erro ao remover',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  return {
    integration,
    isLoading,
    isSaving,
    isTesting,
    loadIntegration,
    saveIntegration,
    testConnection,
    deleteIntegration,
  };
}
