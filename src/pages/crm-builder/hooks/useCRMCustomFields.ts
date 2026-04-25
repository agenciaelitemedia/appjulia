import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Json } from '@/integrations/supabase/types';
import { logCRMAudit } from './useCRMAuditLog';

export type FieldType = 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'checkbox' | 'url' | 'email' | 'phone';

export interface FieldOption {
  value: string;
  label: string;
}

export interface CRMCustomField {
  id: string;
  board_id: string;
  cod_agent: string;
  client_id?: string;
  field_name: string;
  field_label: string;
  field_type: FieldType;
  options: FieldOption[];
  default_value?: string;
  is_required: boolean;
  is_visible: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface CRMCustomFieldFormData {
  field_name: string;
  field_label: string;
  field_type: FieldType;
  options?: FieldOption[];
  default_value?: string;
  is_required?: boolean;
}

interface UseCRMCustomFieldsOptions {
  boardId: string | null;
  clientId: string;
  codAgent: string;
  canManage?: boolean;
}

export function useCRMCustomFields({ boardId, clientId, codAgent, canManage = true }: UseCRMCustomFieldsOptions) {
  const { toast } = useToast();
  const [fields, setFields] = useState<CRMCustomField[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all custom fields for the board
  const fetchFields = useCallback(async () => {
    if (!boardId || !clientId) {
      setFields([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('crm_custom_fields')
        .select('*')
        .eq('board_id', boardId)
        .eq('client_id', clientId)
        .order('position', { ascending: true });

      if (queryError) throw queryError;

      // Transform options from JSON
      const transformed: CRMCustomField[] = (data || []).map((item) => ({
        id: item.id,
        board_id: item.board_id,
        cod_agent: item.cod_agent,
        field_name: item.field_name,
        field_label: item.field_label,
        field_type: item.field_type as FieldType,
        options: (item.options as unknown as FieldOption[]) || [],
        default_value: item.default_value || undefined,
        is_required: item.is_required,
        is_visible: item.is_visible,
        position: item.position,
        created_at: item.created_at,
        updated_at: item.updated_at,
      }));

      setFields(transformed);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar campos';
      setError(message);
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [boardId, clientId, toast]);

  // Create a new custom field
  const createField = useCallback(async (data: CRMCustomFieldFormData): Promise<CRMCustomField | null> => {
    if (!boardId || !clientId || !canManage) return null;

    try {
      // Get the max position
      const maxPosition = fields.length > 0 
        ? Math.max(...fields.map(f => f.position)) + 1 
        : 0;

      const insertData = {
        board_id: boardId,
        client_id: clientId,
        cod_agent: codAgent,
        field_name: data.field_name,
        field_label: data.field_label,
        field_type: data.field_type,
        options: JSON.parse(JSON.stringify(data.options || [])) as Json,
        default_value: data.default_value || null,
        is_required: data.is_required || false,
        position: maxPosition,
      };

      const { data: newField, error: insertError } = await supabase
        .from('crm_custom_fields')
        .insert(insertData)
        .select()
        .single();

      if (insertError) throw insertError;

      const field: CRMCustomField = {
        id: newField.id,
        board_id: newField.board_id,
        cod_agent: newField.cod_agent,
        field_name: newField.field_name,
        field_label: newField.field_label,
        field_type: newField.field_type as FieldType,
        options: (newField.options as unknown as FieldOption[]) || [],
        default_value: newField.default_value || undefined,
        is_required: newField.is_required,
        is_visible: newField.is_visible,
        position: newField.position,
        created_at: newField.created_at,
        updated_at: newField.updated_at,
      };

      setFields(prev => [...prev, field]);

      logCRMAudit({
        clientId,
        codAgent,
        entityType: 'custom_field',
        entityId: field.id,
        entityName: field.field_label,
        action: 'created',
        changes: { board_id: boardId, field_type: field.field_type, field_name: field.field_name },
      });

      toast({
        title: 'Campo criado',
        description: `Campo "${data.field_label}" foi criado com sucesso.`,
      });

      return field;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar campo';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      return null;
    }
  }, [boardId, clientId, codAgent, canManage, fields, toast]);

  // Update a custom field
  const updateField = useCallback(async (fieldId: string, data: Partial<CRMCustomFieldFormData>): Promise<boolean> => {
    if (!canManage) return false;
    try {
      const { error: updateError } = await supabase
        .from('crm_custom_fields')
        .update({
          field_label: data.field_label,
          field_type: data.field_type,
          options: data.options ? JSON.parse(JSON.stringify(data.options)) as Json : undefined,
          default_value: data.default_value,
          is_required: data.is_required,
        })
        .eq('id', fieldId);

      if (updateError) throw updateError;

      setFields(prev => prev.map(f => 
        f.id === fieldId 
          ? { ...f, ...data } as CRMCustomField
          : f
      ));

      logCRMAudit({
        clientId,
        codAgent,
        entityType: 'custom_field',
        entityId: fieldId,
        entityName: data.field_label ?? fields.find(f => f.id === fieldId)?.field_label ?? null,
        action: 'updated',
        changes: { ...(data as Record<string, unknown>), board_id: boardId },
      });

      toast({
        title: 'Campo atualizado',
        description: 'As alterações foram salvas.',
      });

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar campo';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      return false;
    }
  }, [canManage, clientId, codAgent, boardId, fields, toast]);

  // Delete a custom field
  const deleteField = useCallback(async (fieldId: string): Promise<boolean> => {
    if (!canManage) return false;
    try {
      const target = fields.find(f => f.id === fieldId);
      const { error: deleteError } = await supabase
        .from('crm_custom_fields')
        .delete()
        .eq('id', fieldId);

      if (deleteError) throw deleteError;

      setFields(prev => prev.filter(f => f.id !== fieldId));

      logCRMAudit({
        clientId,
        codAgent,
        entityType: 'custom_field',
        entityId: fieldId,
        entityName: target?.field_label ?? null,
        action: 'deleted',
        changes: { board_id: boardId },
      });

      toast({
        title: 'Campo removido',
        description: 'O campo foi removido com sucesso.',
      });

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao remover campo';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      return false;
    }
  }, [canManage, clientId, codAgent, boardId, fields, toast]);

  // Reorder fields
  const reorderFields = useCallback(async (reorderedFields: CRMCustomField[]) => {
    if (!canManage) return;
    // Optimistic update
    setFields(reorderedFields);

    try {
      // Update positions in database
      const updates = reorderedFields.map((field, index) => 
        supabase
          .from('crm_custom_fields')
          .update({ position: index })
          .eq('id', field.id)
      );

      await Promise.all(updates);

      logCRMAudit({
        clientId,
        codAgent,
        entityType: 'custom_field',
        entityId: reorderedFields[0]?.id ?? '00000000-0000-0000-0000-000000000000',
        entityName: null,
        action: 'reordered',
        changes: {
          board_id: boardId,
          order: reorderedFields.map(f => ({ id: f.id, label: f.field_label })),
        },
      });
    } catch (err) {
      // Revert on error
      fetchFields();
      const message = err instanceof Error ? err.message : 'Erro ao reordenar campos';
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
    }
  }, [canManage, clientId, codAgent, boardId, fetchFields, toast]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!boardId || !clientId) return;

    const channel = supabase
      .channel(`crm-custom-fields-${clientId}-${boardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'crm_custom_fields',
          filter: `board_id=eq.${boardId}`,
        },
        () => {
          fetchFields();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [boardId, clientId, fetchFields]);

  // Fetch on board change
  useEffect(() => {
    fetchFields();
  }, [fetchFields]);

  return {
    fields,
    isLoading,
    error,
    fetchFields,
    createField,
    updateField,
    deleteField,
    reorderFields,
  };
}
