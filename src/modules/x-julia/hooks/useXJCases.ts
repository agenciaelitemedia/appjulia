import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '../extend/db';
import { useXJIdentity } from '../extend/auth';
import { useXJEffectiveClientId } from '../context/XJScopeContext';
import type { XJCaseKnowledge, XJCaseQuestion, XJLegalCase } from '../types';

const KEY = ['x-julia', 'cases'];

export function useXJCases() {
  const { clientId } = useXJEffectiveClientId();
  return useQuery<XJLegalCase[]>({
    queryKey: [...KEY, clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('xj_legal_cases')
        .select('*')
        .eq('client_id', String(clientId))
        .order('category')
        .order('position');
      if (error) throw error;
      return (data || []) as unknown as XJLegalCase[];
    },
  });
}

export function useXJCaseMutations() {
  const queryClient = useQueryClient();
  const { clientId } = useXJEffectiveClientId();
  const { userName } = useXJIdentity();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: KEY });

  const create = useMutation({
    mutationFn: async (input: Partial<XJLegalCase>) => {
      if (!clientId) throw new Error('Escritório não identificado');
      const { data, error } = await supabase
        .from('xj_legal_cases')
        .insert({
          client_id: String(clientId),
          name: input.name || 'Novo caso',
          category: input.category || 'Geral',
          summary: input.summary ?? null,
          created_by: userName,
        } as any)
        .select('*')
        .single();
      if (error) throw error;
      return data as unknown as XJLegalCase;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Caso criado');
    },
    onError: (e: any) => toast.error(`Falha ao criar caso: ${e.message}`),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<XJLegalCase> }) => {
      const { error } = await supabase.from('xj_legal_cases').update(patch as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Caso atualizado');
    },
    onError: (e: any) => toast.error(`Falha ao salvar caso: ${e.message}`),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('xj_legal_cases').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Caso removido');
    },
    onError: (e: any) => toast.error(`Falha ao remover caso: ${e.message}`),
  });

  return { create, update, remove };
}

export function useXJCaseQuestions(caseId?: string) {
  const queryClient = useQueryClient();
  const { clientId } = useXJEffectiveClientId();

  const query = useQuery<XJCaseQuestion[]>({
    queryKey: ['x-julia', 'case-questions', caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('xj_case_questions')
        .select('*')
        .eq('case_id', caseId!)
        .order('position');
      if (error) throw error;
      return (data || []) as unknown as XJCaseQuestion[];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['x-julia', 'case-questions', caseId] });

  const add = useMutation({
    mutationFn: async (input: { question: string; slot_key?: string; is_required?: boolean }) => {
      if (!caseId || !clientId) throw new Error('Caso não identificado');
      const position = (query.data?.length ?? 0);
      const { error } = await supabase.from('xj_case_questions').insert({
        client_id: String(clientId),
        case_id: caseId,
        position,
        question: input.question,
        slot_key: input.slot_key ?? null,
        is_required: input.is_required ?? true,
      } as any);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(`Falha ao adicionar pergunta: ${e.message}`),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<XJCaseQuestion> }) => {
      const { error } = await supabase.from('xj_case_questions').update(patch as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('xj_case_questions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { ...query, add, update, remove };
}

export function useXJCaseKnowledge(caseId?: string) {
  const queryClient = useQueryClient();
  const { clientId } = useXJEffectiveClientId();
  const { userName } = useXJIdentity();

  const query = useQuery<XJCaseKnowledge[]>({
    queryKey: ['x-julia', 'case-knowledge', caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('xj_case_knowledge')
        .select('*')
        .eq('case_id', caseId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as XJCaseKnowledge[];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['x-julia', 'case-knowledge', caseId] });

  const add = useMutation({
    mutationFn: async (input: { title: string; content?: string; file_url?: string; file_name?: string; source_type?: string }) => {
      if (!caseId || !clientId) throw new Error('Caso não identificado');
      const { error } = await supabase.from('xj_case_knowledge').insert({
        client_id: String(clientId),
        case_id: caseId,
        title: input.title,
        content: input.content ?? null,
        file_url: input.file_url ?? null,
        file_name: input.file_name ?? null,
        source_type: input.source_type ?? (input.file_url ? 'file' : 'text'),
        created_by: userName,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Conteúdo adicionado à base');
    },
    onError: (e: any) => toast.error(`Falha ao adicionar conteúdo: ${e.message}`),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('xj_case_knowledge').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { ...query, add, remove };
}

export function useXJCtaTriggers() {
  const queryClient = useQueryClient();
  const { clientId } = useXJEffectiveClientId();

  const query = useQuery({
    queryKey: ['x-julia', 'cta-triggers', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('xj_cta_triggers')
        .select('*')
        .eq('client_id', String(clientId))
        .order('priority', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['x-julia', 'cta-triggers'] });

  const save = useMutation({
    mutationFn: async (input: any) => {
      if (!clientId) throw new Error('Escritório não identificado');
      if (input.id) {
        const { id, ...patch } = input;
        const { error } = await supabase.from('xj_cta_triggers').update(patch).eq('id', id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from('xj_cta_triggers')
        .insert({ ...input, client_id: String(clientId) });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Gatilho salvo');
    },
    onError: (e: any) => toast.error(`Falha ao salvar gatilho: ${e.message}`),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('xj_cta_triggers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { ...query, save, remove };
}