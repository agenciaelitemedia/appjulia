import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Json } from '@/integrations/supabase/types';

// Tipos de automação
export type TriggerType = 'field_change' | 'time_based' | 'on_create';
export type TriggerOperator = 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'is_empty' | 'is_not_empty';
export type ActionType = 'move_to_pipeline' | 'update_field' | 'set_status';

export interface AutomationCondition {
  field: string;
  operator: TriggerOperator;
  value: string;
}

export interface CRMAutomationRule {
  id: string;
  board_id: string;
  cod_agent: string;
  name: string;
  description?: string;
  is_active: boolean;
  trigger_type: TriggerType;
  trigger_field?: string;
  trigger_operator?: TriggerOperator;
  trigger_value?: string;
  conditions: AutomationCondition[];
  from_pipeline_id?: string;
  to_pipeline_id?: string;
  action_type: ActionType;
  action_data: Record<string, unknown>;
  position: number;
  execution_count: number;
  last_executed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CRMAutomationRuleFormData {
  name: string;
  description?: string;
  is_active?: boolean;
  trigger_type: TriggerType;
  trigger_field?: string;
  trigger_operator?: TriggerOperator;
  trigger_value?: string;
  conditions?: AutomationCondition[];
  from_pipeline_id?: string;
  to_pipeline_id?: string;
  action_type: ActionType;
  action_data?: Record<string, unknown>;
}

interface UseCRMAutomationsOptions {
  boardId: string | null;
  codAgent: string;
}

export function useCRMAutomations({ boardId, codAgent }: UseCRMAutomationsOptions) {
  const { toast } = useToast();
  const [rules, setRules] = useState<CRMAutomationRule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all automation rules for the board
  const fetchRules = useCallback(async () => {
    if (!boardId || !codAgent) {
      setRules([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('crm_automation_rules')
        .select('*')
        .eq('board_id', boardId)
        .eq('cod_agent', codAgent)
        .order('position', { ascending: true });

      if (queryError) throw queryError;

      // Transform data to match our interface
      const transformedRules: CRMAutomationRule[] = (data || []).map((rule) => ({
        id: rule.id,
        board_id: rule.board_id,
        cod_agent: rule.cod_agent,
        name: rule.name,
        description: rule.description || undefined,
        is_active: rule.is_active,
        trigger_type: rule.trigger_type as TriggerType,
        trigger_field: rule.trigger_field || undefined,
        trigger_operator: rule.trigger_operator as TriggerOperator | undefined,
        trigger_value: rule.trigger_value || undefined,
        conditions: (Array.isArray(rule.conditions) ? rule.conditions as unknown as AutomationCondition[] : []),
        from_pipeline_id: rule.from_pipeline_id || undefined,
        to_pipeline_id: rule.to_pipeline_id || undefined,
        action_type: rule.action_type as ActionType,
        action_data: (rule.action_data as Record<string, unknown>) || {},
        position: rule.position,
        execution_count: rule.execution_count,
        last_executed_at: rule.last_executed_at || undefined,
        created_at: rule.created_at,
        updated_at: rule.updated_at,
      }));

      setRules(transformedRules);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar automações';
      setError(message);
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [boardId, codAgent, toast]);

  // Create a new automation rule
  const createRule = useCallback(async (data: CRMAutomationRuleFormData): Promise<CRMAutomationRule | null> => {
    if (!boardId || !codAgent) return null;

    try {
      const maxPosition = rules.length > 0 
        ? Math.max(...rules.map(r => r.position)) + 1 
        : 0;

      const insertPayload = {
        board_id: boardId,
        cod_agent: codAgent,
        name: data.name,
        description: data.description || null,
        is_active: data.is_active ?? true,
        trigger_type: data.trigger_type,
        trigger_field: data.trigger_field || null,
        trigger_operator: data.trigger_operator || null,
        trigger_value: data.trigger_value || null,
        conditions: (data.conditions || []) as unknown as Json,
        from_pipeline_id: data.from_pipeline_id || null,
        to_pipeline_id: data.to_pipeline_id || null,
        action_type: data.action_type,
        action_data: (data.action_data || {}) as unknown as Json,
        position: maxPosition,
      };

      const { data: newRule, error: insertError } = await supabase
        .from('crm_automation_rules')
        .insert([insertPayload])
        .select()
        .single();

      if (insertError) throw insertError;

      const transformedRule: CRMAutomationRule = {
        id: newRule.id,
        board_id: newRule.board_id,
        cod_agent: newRule.cod_agent,
        name: newRule.name,
        description: newRule.description || undefined,
        is_active: newRule.is_active,
        trigger_type: newRule.trigger_type as TriggerType,
        trigger_field: newRule.trigger_field || undefined,
        trigger_operator: newRule.trigger_operator as TriggerOperator | undefined,
        trigger_value: newRule.trigger_value || undefined,
        conditions: (Array.isArray(newRule.conditions) ? newRule.conditions as unknown as AutomationCondition[] : []),
        from_pipeline_id: newRule.from_pipeline_id || undefined,
        to_pipeline_id: newRule.to_pipeline_id || undefined,
        action_type: newRule.action_type as ActionType,
        action_data: (newRule.action_data as Record<string, unknown>) || {},
        position: newRule.position,
        execution_count: newRule.execution_count,
        last_executed_at: newRule.last_executed_at || undefined,
        created_at: newRule.created_at,
        updated_at: newRule.updated_at,
      };

      setRules(prev => [...prev, transformedRule]);

      toast({
        title: 'Automação criada',
        description: `"${data.name}" foi criada com sucesso.`,
      });

      return transformedRule;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar automação';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      return null;
    }
  }, [boardId, codAgent, rules, toast]);

  // Update an automation rule
  const updateRule = useCallback(async (ruleId: string, data: Partial<CRMAutomationRuleFormData>): Promise<boolean> => {
    try {
      const updatePayload: Record<string, unknown> = {};
      
      if (data.name !== undefined) updatePayload.name = data.name;
      if (data.description !== undefined) updatePayload.description = data.description;
      if (data.is_active !== undefined) updatePayload.is_active = data.is_active;
      if (data.trigger_type !== undefined) updatePayload.trigger_type = data.trigger_type;
      if (data.trigger_field !== undefined) updatePayload.trigger_field = data.trigger_field;
      if (data.trigger_operator !== undefined) updatePayload.trigger_operator = data.trigger_operator;
      if (data.trigger_value !== undefined) updatePayload.trigger_value = data.trigger_value;
      if (data.conditions !== undefined) updatePayload.conditions = data.conditions;
      if (data.from_pipeline_id !== undefined) updatePayload.from_pipeline_id = data.from_pipeline_id;
      if (data.to_pipeline_id !== undefined) updatePayload.to_pipeline_id = data.to_pipeline_id;
      if (data.action_type !== undefined) updatePayload.action_type = data.action_type;
      if (data.action_data !== undefined) updatePayload.action_data = data.action_data;

      const { error: updateError } = await supabase
        .from('crm_automation_rules')
        .update(updatePayload)
        .eq('id', ruleId);

      if (updateError) throw updateError;

      setRules(prev => prev.map(r => 
        r.id === ruleId 
          ? { ...r, ...data } as CRMAutomationRule
          : r
      ));

      toast({
        title: 'Automação atualizada',
        description: 'As alterações foram salvas.',
      });

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar automação';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  // Toggle rule active status
  const toggleRuleActive = useCallback(async (ruleId: string): Promise<boolean> => {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return false;

    return updateRule(ruleId, { is_active: !rule.is_active });
  }, [rules, updateRule]);

  // Delete an automation rule
  const deleteRule = useCallback(async (ruleId: string): Promise<boolean> => {
    try {
      const { error: deleteError } = await supabase
        .from('crm_automation_rules')
        .delete()
        .eq('id', ruleId);

      if (deleteError) throw deleteError;

      setRules(prev => prev.filter(r => r.id !== ruleId));

      toast({
        title: 'Automação removida',
        description: 'A automação foi removida com sucesso.',
      });

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao remover automação';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  // Set up realtime subscription
  useEffect(() => {
    if (!boardId || !codAgent) return;

    const channel = supabase
      .channel(`crm-automations-${boardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'crm_automation_rules',
          filter: `board_id=eq.${boardId}`,
        },
        () => {
          fetchRules();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [boardId, codAgent, fetchRules]);

  // Fetch on board change
  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  return {
    rules,
    isLoading,
    error,
    fetchRules,
    createRule,
    updateRule,
    toggleRuleActive,
    deleteRule,
  };
}

// Trigger field options
export const TRIGGER_FIELDS = [
  { value: 'priority', label: 'Prioridade' },
  { value: 'status', label: 'Status' },
  { value: 'value', label: 'Valor' },
  { value: 'contact_name', label: 'Nome do Contato' },
  { value: 'tags', label: 'Tags' },
] as const;

// Trigger operator options
export const TRIGGER_OPERATORS: Record<TriggerOperator, string> = {
  equals: 'Igual a',
  not_equals: 'Diferente de',
  greater_than: 'Maior que',
  less_than: 'Menor que',
  contains: 'Contém',
  is_empty: 'Está vazio',
  is_not_empty: 'Não está vazio',
};

// Trigger type options
export const TRIGGER_TYPES: Record<TriggerType, string> = {
  field_change: 'Quando um campo mudar',
  time_based: 'Baseado em tempo',
  on_create: 'Quando card for criado',
};

// Action type options
export const ACTION_TYPES: Record<ActionType, string> = {
  move_to_pipeline: 'Mover para etapa',
  update_field: 'Atualizar campo',
  set_status: 'Definir status',
};
