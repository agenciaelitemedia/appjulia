import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { externalDb } from '@/lib/externalDb';
import type { AdvboxNotificationRule, AdvboxNotificationRuleFormData } from '@/types/advbox';

interface UseNotificationRulesReturn {
  rules: AdvboxNotificationRule[];
  isLoading: boolean;
  isSaving: boolean;
  loadRules: (codAgent: string) => Promise<void>;
  saveRule: (codAgent: string, integrationId: string, data: AdvboxNotificationRuleFormData, ruleId?: string) => Promise<boolean>;
  toggleRule: (ruleId: string, isActive: boolean) => Promise<boolean>;
  deleteRule: (ruleId: string) => Promise<boolean>;
}

export function useNotificationRules(): UseNotificationRulesReturn {
  const { toast } = useToast();
  const [rules, setRules] = useState<AdvboxNotificationRule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadRules = useCallback(async (codAgent: string) => {
    setIsLoading(true);
    try {
      const result = await externalDb.raw<AdvboxNotificationRule>({
        query: `
          SELECT 
            anr.*,
            (SELECT COUNT(*) FROM advbox_notification_logs anl WHERE anl.rule_id = anr.id) as notifications_sent,
            (SELECT MAX(created_at) FROM advbox_notification_logs anl WHERE anl.rule_id = anr.id) as last_triggered
          FROM advbox_notification_rules anr
          WHERE anr.cod_agent = $1
          ORDER BY anr.created_at DESC
        `,
        params: [codAgent],
      });

      setRules(result);
    } catch (error) {
      console.error('Error loading notification rules:', error);
      toast({
        title: 'Erro ao carregar regras',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const saveRule = useCallback(async (
    agentId: number,
    integrationId: string,
    data: AdvboxNotificationRuleFormData,
    ruleId?: string
  ): Promise<boolean> => {
    setIsSaving(true);
    try {
      if (ruleId) {
        // Update existing rule
        await externalDb.raw({
          query: `
            UPDATE advbox_notification_rules SET
              rule_name = $1,
              is_active = $2,
              process_phases = $3,
              event_types = $4,
              keywords = $5,
              message_template = $6,
              send_to = $7,
              cooldown_minutes = $8,
              updated_at = NOW()
            WHERE id = $9
          `,
          params: [
            data.rule_name,
            data.is_active,
            data.process_phases,
            data.event_types,
            data.keywords,
            data.message_template,
            data.send_to,
            data.cooldown_minutes,
            ruleId,
          ],
        });
      } else {
        // Create new rule
        await externalDb.raw({
          query: `
            INSERT INTO advbox_notification_rules 
              (agent_id, integration_id, rule_name, is_active, process_phases, event_types, keywords, message_template, send_to, cooldown_minutes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `,
          params: [
            agentId,
            integrationId,
            data.rule_name,
            data.is_active ?? true,
            data.process_phases,
            data.event_types,
            data.keywords,
            data.message_template,
            data.send_to || 'cliente',
            data.cooldown_minutes || 60,
          ],
        });
      }

      toast({
        title: ruleId ? 'Regra atualizada' : 'Regra criada',
        description: 'A regra de notificação foi salva com sucesso.',
      });

      // Reload rules
      await loadRules(agentId);
      return true;
    } catch (error) {
      console.error('Error saving rule:', error);
      toast({
        title: 'Erro ao salvar regra',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [toast, loadRules]);

  const toggleRule = useCallback(async (ruleId: string, isActive: boolean): Promise<boolean> => {
    try {
      await externalDb.raw({
        query: `UPDATE advbox_notification_rules SET is_active = $1, updated_at = NOW() WHERE id = $2`,
        params: [isActive, ruleId],
      });

      setRules(prev => prev.map(rule => 
        rule.id === ruleId ? { ...rule, is_active: isActive } : rule
      ));

      toast({
        title: isActive ? 'Regra ativada' : 'Regra desativada',
        description: `A regra foi ${isActive ? 'ativada' : 'desativada'} com sucesso.`,
      });

      return true;
    } catch (error) {
      console.error('Error toggling rule:', error);
      toast({
        title: 'Erro ao alterar regra',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  const deleteRule = useCallback(async (ruleId: string): Promise<boolean> => {
    try {
      await externalDb.raw({
        query: `DELETE FROM advbox_notification_rules WHERE id = $1`,
        params: [ruleId],
      });

      setRules(prev => prev.filter(rule => rule.id !== ruleId));

      toast({
        title: 'Regra removida',
        description: 'A regra de notificação foi excluída.',
      });

      return true;
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast({
        title: 'Erro ao excluir regra',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  return {
    rules,
    isLoading,
    isSaving,
    loadRules,
    saveRule,
    toggleRule,
    deleteRule,
  };
}
