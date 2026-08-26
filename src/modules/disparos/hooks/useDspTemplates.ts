import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '../extend/db';
import type { DspTemplate } from '../types';

const TABLE = 'dsp_message_templates';

export function useDspTemplates(clientId: string | null, onlyApproved = false) {
  return useQuery<DspTemplate[]>({
    queryKey: ['disparos', 'templates', clientId, onlyApproved],
    enabled: !!clientId,
    queryFn: async () => {
      let q = (supabase as any)
        .from(TABLE)
        .select('*')
        .eq('client_id', String(clientId))
        .order('created_at', { ascending: false });
      if (onlyApproved) q = q.eq('status', 'approved').eq('is_active', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as DspTemplate[];
    },
  });
}

export interface SaveTemplateInput {
  id?: string;
  client_id: string;
  name: string;
  category: string;
  body: string;
  media_url?: string | null;
  media_type?: string | null;
  created_by?: string | null;
}

/** Extrai as variáveis {{...}} usadas no corpo do template. */
export function extractVariables(body: string): string[] {
  const found = new Set<string>();
  for (const m of body.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) found.add(m[1]);
  return [...found];
}

export function useSaveDspTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveTemplateInput) => {
      const payload = {
        ...input,
        body: input.body.trim(),
        variables: extractVariables(input.body),
      };
      if (input.id) {
        // Editar um template já aprovado o devolve para rascunho: exige nova aprovação.
        const { error } = await (supabase as any)
          .from(TABLE)
          .update({
            ...payload,
            status: 'draft',
            approved_at: null,
            approved_by: null,
            submitted_at: null,
            submitted_by: null,
          })
          .eq('id', input.id);
        if (error) throw error;
        return input.id;
      }
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .insert({ ...payload, status: 'draft' })
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['disparos', 'templates'] });
      toast.success('Template salvo (rascunho)');
    },
    onError: (e: any) => toast.error('Erro ao salvar template', { description: e?.message }),
  });
}

export type TemplateReviewAction = 'submit' | 'approve' | 'reject' | 'archive';

export function useDspTemplateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      id: string;
      action: TemplateReviewAction;
      actor?: string | null;
      notes?: string | null;
    }) => {
      const nowIso = new Date().toISOString();
      const patch: Record<string, unknown> =
        vars.action === 'submit'
          ? { status: 'pending', submitted_at: nowIso, submitted_by: vars.actor ?? null, review_notes: null }
          : vars.action === 'approve'
            ? { status: 'approved', approved_at: nowIso, approved_by: vars.actor ?? null, review_notes: vars.notes ?? null }
            : vars.action === 'reject'
              ? { status: 'rejected', approved_at: null, approved_by: null, review_notes: vars.notes ?? null }
              : { is_active: false };

      const { error } = await (supabase as any).from(TABLE).update(patch).eq('id', vars.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['disparos', 'templates'] });
      const map: Record<TemplateReviewAction, string> = {
        submit: 'Enviado para aprovação',
        approve: 'Template aprovado',
        reject: 'Template reprovado',
        archive: 'Template arquivado',
      };
      toast.success(map[v.action]);
    },
    onError: (e: any) => toast.error('Erro na revisão', { description: e?.message }),
  });
}

export function useDeleteDspTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from(TABLE).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['disparos', 'templates'] });
      toast.success('Template excluído');
    },
    onError: (e: any) => toast.error('Erro ao excluir', { description: e?.message }),
  });
}
