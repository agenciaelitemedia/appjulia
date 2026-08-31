import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LidiaQuestion {
  text: string;
  why: string;
}

export interface LidiaObjection {
  detected: boolean;
  type: 'preco' | 'desconfianca' | 'vou_pensar' | 'silencio' | 'outra' | '';
  technique: string;
  reply: string;
}

export interface LidiaLegalAnalysis {
  summary: string;
  strength: 'forte' | 'medio' | 'fraco' | 'inconclusivo' | string;
  evidence_needed: string[];
  risks: string[];
}

export interface LidiaCallStep {
  step: string;
  text: string;
}

export interface LidiaCall {
  recommended: boolean;
  reason: string;
  script: LidiaCallStep[];
}

export interface LidiaSuggestedReply {
  when_to_use: string;
  text: string;
}

export interface LidiaOutput {
  phase: string;
  next_step: string;
  confidence: number;
  incomplete_info: string[];
  questions: LidiaQuestion[];
  suggested_reply: LidiaSuggestedReply;
  legal_analysis: LidiaLegalAnalysis;
  objection: LidiaObjection;
  call: LidiaCall;
  understanding_check: string;
}

export interface LidiaMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface LidiaAnalysisResponse {
  output: LidiaOutput;
  agent: { cod_agent: string } | null;
}

interface UseLidiaOptions {
  clientId: string | null;
  conversationId: string | null;
  userEmail: string | null;
  enabled?: boolean;
}

async function invokeLidia(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('lidia-copilot', { body });
  if (error) throw error;
  return data as LidiaAnalysisResponse;
}

export function useLidia({ clientId, conversationId, userEmail, enabled }: UseLidiaOptions) {
  const queryClient = useQueryClient();
  const key = useMemo(
    () => ['lidia', clientId, conversationId],
    [clientId, conversationId],
  );

  const latestKey = useMemo(
    () => (clientId && conversationId ? ['lidia', 'latest', clientId, conversationId] : null),
    [clientId, conversationId],
  );

  const latestQuery = useQuery({
    queryKey: latestKey ?? ['lidia', 'disabled'],
    queryFn: async () => {
      if (!clientId || !conversationId) return null;
      const { data, error } = await supabase
        .from('lidia_sessions')
        .select('phase, last_analysis, confidence, updated_at')
        .eq('client_id', clientId)
        .eq('conversation_id', conversationId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as {
        phase: string;
        last_analysis: LidiaOutput;
        confidence: number | null;
        updated_at: string;
      } | null;
    },
    enabled: !!enabled && !!latestKey,
    staleTime: 30_000,
  });

  const historyQuery = useQuery({
    queryKey: [...key, 'messages'],
    queryFn: async () => {
      if (!clientId || !conversationId) return [];
      const { data, error } = await supabase
        .from('lidia_messages')
        .select('id, role, content, created_at')
        .eq('client_id', clientId)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as LidiaMessage[];
    },
    enabled: !!enabled && !!clientId && !!conversationId,
    staleTime: 30_000,
  });

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      if (!clientId || !conversationId || !userEmail) throw new Error('Dados incompletos');
      return invokeLidia({
        action: 'analyze',
        conversation_id: conversationId,
        client_id: clientId,
        user_email: userEmail,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });

  const chatMutation = useMutation({
    mutationFn: async (question: string) => {
      if (!clientId || !conversationId || !userEmail) throw new Error('Dados incompletos');
      return invokeLidia({
        action: 'chat',
        conversation_id: conversationId,
        client_id: clientId,
        user_email: userEmail,
        question,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });

  const sendUnderstanding = useCallback(
    async (understood: boolean) => {
      if (!clientId || !conversationId) return;
      await supabase.from('lidia_messages').insert({
        client_id: clientId,
        conversation_id: conversationId,
        role: 'user',
        content: understood ? 'Entendi.' : 'Não entendi.',
      });
      queryClient.invalidateQueries({ queryKey: key });
    },
    [clientId, conversationId, key, queryClient],
  );

  return {
    latest: latestQuery.data,
    latestLoading: latestQuery.isLoading,
    messages: historyQuery.data ?? [],
    messagesLoading: historyQuery.isLoading,
    analyze: analyzeMutation.mutate,
    analyzeLoading: analyzeMutation.isPending,
    analyzeError: analyzeMutation.error,
    chat: chatMutation.mutate,
    chatLoading: chatMutation.isPending,
    chatError: chatMutation.error,
    sendUnderstanding,
  };
}
