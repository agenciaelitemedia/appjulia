import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SimulationNodeLog {
  node_id: string;
  kind: string;
  label: string;
  status: 'ok' | 'skipped' | 'error';
  detail?: string;
  branch?: string;
  at: string;
  duration_ms?: number;
  variables?: Record<string, unknown>;
}

export interface SimulationResult {
  flow_id: string;
  flow_name: string;
  status: 'completed' | 'failed';
  logs: SimulationNodeLog[];
  error?: string;
}

/** Executa o fluxo em modo simulação (nenhuma mensagem é enviada de verdade). */
export function useFlowSimulation() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (params: {
    flowId: string;
    messageText: string;
    messageType?: string;
    conversationId?: string | null;
  }) => {
    setIsRunning(true);
    setError(null);
    setResult(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('chat-flow-engine', {
        body: {
          action: 'simulate',
          data: {
            event: 'message_received',
            flow_id: params.flowId,
            simulate: true,
            message_text: params.messageText,
            message_type: params.messageType || 'text',
            conversation_id: params.conversationId || null,
          },
        },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      const first = (data?.results ?? [])[0] as SimulationResult | undefined;
      if (!first) throw new Error('O fluxo não retornou nenhum resultado.');
      setResult(first);
      return first;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      return null;
    } finally {
      setIsRunning(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
  };

  return { run, reset, isRunning, result, error };
}