import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Json } from '@/integrations/supabase/types';

export type FieldType = 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'checkbox' | 'url' | 'email' | 'phone';

export interface FieldOption {
  value: string;
  label: string;
}

export interface CRMCustomField {
  id: string;
  board_id: string;
  cod_agent: string;
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
  codAgent: string;
}

export function useCRMCustomFields({ boardId, codAgent }: UseCRMCustomFieldsOptions) {
  const { toast } = useToast();
  const [fields, setFields] = useState<CRMCustomField[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all custom fields for the board
  const fetchFields = useCallback(async () => {
    if (!boardId || !codAgent) {
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
        .eq('cod_agent', codAgent)
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
  }, [boardId, codAgent, toast]);

  // Create a new custom field
  const createField = useCallback(async (data: CRMCustomFieldFormData): Promise<CRMCustomField | null> => {
    if (!boardId || !codAgent) return null;

    try {
      // Get the max position
      const maxPosition = fields.length > 0 
        ? Math.max(...fields.map(f => f.position)) + 1 
        : 0;

      const insertData = {
        board_id: boardId,
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
  }, [boardId, codAgent, fields, toast]);

  // Update a custom field
  const updateField = useCallback(async (fieldId: string, data: Partial<CRMCustomFieldFormData>): Promise<boolean> => {
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
  }, [toast]);

  // Delete a custom field
  const deleteField = useCallback(async (fieldId: string): Promise<boolean> => {
    try {
      const { error: deleteError } = await supabase
        .from('crm_custom_fields')
        .delete()
        .eq('id', fieldId);

      if (deleteError) throw deleteError;

      setFields(prev => prev.filter(f => f.id !== fieldId));

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
  }, [toast]);

  // Reorder fields
  const reorderFields = useCallback(async (reorderedFields: CRMCustomField[]) => {
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
  }, [fetchFields, toast]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!boardId || !codAgent) return;

    const channel = supabase
      .channel(`crm-custom-fields-${boardId}`)
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
  }, [boardId, codAgent, fetchFields]);

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
