import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '../extend/db';
import { useXJClientId } from '../extend/auth';
import type { XJSession, XJSessionEvent } from '../types';

export interface XJSessionFilters {
  stage?: string;
  qualification?: string;
  search?: string;
  onlyActive?: boolean;
}

export function useXJSessions(filters: XJSessionFilters = {}) {
  const { data: clientId } = useXJClientId();
  return useQuery<XJSession[]>({
    queryKey: ['x-julia', 'sessions', clientId, filters],
    enabled: !!clientId,
    refetchInterval: 30_000,
    queryFn: async () => {
      let query = supabase
        .from('xj_sessions')
        .select('*')
        .eq('client_id', String(clientId))
        .order('updated_at', { ascending: false })
        .limit(200);
      if (filters.stage) query = query.eq('stage', filters.stage);
      if (filters.qualification) query = query.eq('qualification', filters.qualification);
      if (filters.onlyActive) query = query.eq('is_active', true);
      if (filters.search?.trim()) {
        const term = `%${filters.search.trim()}%`;
        query = query.or(`contact_name.ilike.${term},phone.ilike.${term},case_type.ilike.${term}`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as XJSession[];
    },
  });
}

export function useXJSession(sessionId?: string) {
  return useQuery<XJSession | null>({
    queryKey: ['x-julia', 'session', sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await supabase.from('xj_sessions').select('*').eq('id', sessionId!).maybeSingle();
      if (error) throw error;
      return (data as unknown as XJSession) ?? null;
    },
  });
}

export function useXJSessionEvents(sessionId?: string) {
  return useQuery<XJSessionEvent[]>({
    queryKey: ['x-julia', 'session-events', sessionId],
    enabled: !!sessionId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('xj_session_events')
        .select('*')
        .eq('session_id', sessionId!)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as unknown as XJSessionEvent[];
    },
  });
}

export function useXJSessionActions() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['x-julia', 'sessions'] });
    queryClient.invalidateQueries({ queryKey: ['x-julia', 'session'] });
  };

  const pause = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from('xj_sessions')
        .update({ is_active: false, paused_reason: 'pausado manualmente' })
        .eq('id', sessionId);
      if (error) throw error;
      await supabase.from('xj_followups').update({ status: 'cancelled' }).eq('session_id', sessionId).eq('status', 'pending');
    },
    onSuccess: () => {
      invalidate();
      toast.success('Agente pausado nesta conversa');
    },
    onError: (e: any) => toast.error(`Falha ao pausar: ${e.message}`),
  });

  const resume = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from('xj_sessions')
        .update({ is_active: true, paused_reason: null })
        .eq('id', sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Agente reativado');
    },
    onError: (e: any) => toast.error(`Falha ao reativar: ${e.message}`),
  });

  const setStage = useMutation({
    mutationFn: async ({ sessionId, stage }: { sessionId: string; stage: string }) => {
      const { error } = await supabase.from('xj_sessions').update({ stage }).eq('id', sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Estágio atualizado');
    },
  });

  return { pause, resume, setStage };
}