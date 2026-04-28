import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ChurnSignal {
  conversation_id: string;
  client_id: string;
  contact_name: string;
  reason: 'sentiment_negative' | 'keyword_cancel' | 'low_csat';
  detected_at: string;
  snippet: string;
}

const CHURN_KEYWORDS = ['cancelar', 'desistir', 'reembolso', 'procon', 'reclamar', 'não quero mais', 'estornar'];

/**
 * Detecta sinais de churn/desistência dos últimos 4h.
 * Combina:
 * - chat_conversation_summaries.sentiment = 'negative'
 * - chat_messages com keywords de cancelamento
 * - chat_csat_responses com score <= 2
 */
export function useChurnSignals() {
  return useQuery<{ signals: ChurnSignal[]; total: number }>({
    queryKey: ['tv-churn-signals'],
    queryFn: async () => {
      const since = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
      const signals: ChurnSignal[] = [];
      const seen = new Set<string>();

      const pushUnique = (s: ChurnSignal) => {
        const key = s.conversation_id + ':' + s.reason;
        if (seen.has(key)) return;
        seen.add(key);
        signals.push(s);
      };

      // 1. Sentiment negativo
      try {
        const { data: summaries } = await supabase
          .from('chat_conversation_summaries' as never)
          .select('conversation_id, client_id, contact_id, sentiment, summary, last_message_ts')
          .eq('sentiment', 'negative')
          .gte('last_message_ts', since)
          .limit(50) as any;
        for (const s of summaries ?? []) {
          pushUnique({
            conversation_id: s.conversation_id,
            client_id: String(s.client_id),
            contact_name: s.contact_id || 'Contato',
            reason: 'sentiment_negative',
            detected_at: s.last_message_ts,
            snippet: (s.summary || '').slice(0, 80),
          });
        }
      } catch { /* tabela pode não existir ainda */ }

      // 2. Keywords nas mensagens recentes (últimas 4h, do contato)
      try {
        const { data: msgs } = await supabase
          .from('chat_messages')
          .select('conversation_id, contact_id, client_id, text, timestamp')
          .eq('from_me', false)
          .gte('timestamp', since)
          .not('text', 'is', null)
          .limit(500);
        for (const m of msgs ?? []) {
          const text = (m.text || '').toLowerCase();
          if (CHURN_KEYWORDS.some(k => text.includes(k))) {
            pushUnique({
              conversation_id: m.conversation_id || '',
              client_id: String(m.client_id),
              contact_name: m.contact_id || 'Contato',
              reason: 'keyword_cancel',
              detected_at: m.timestamp,
              snippet: m.text.slice(0, 80),
            });
          }
        }
      } catch { /* noop */ }

      // 3. CSAT baixo (últimas 24h)
      try {
        const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: csat } = await supabase
          .from('chat_csat_responses' as never)
          .select('conversation_id, contact_id, client_id, score, responded_at, feedback')
          .lte('score', 2)
          .gte('responded_at', since24h)
          .limit(50) as any;
        for (const c of csat ?? []) {
          pushUnique({
            conversation_id: c.conversation_id,
            client_id: String(c.client_id),
            contact_name: c.contact_id || 'Contato',
            reason: 'low_csat',
            detected_at: c.responded_at,
            snippet: (c.feedback || `Score ${c.score}`).slice(0, 80),
          });
        }
      } catch { /* noop */ }

      // ordena mais recente primeiro
      signals.sort((a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime());

      return { signals: signals.slice(0, 20), total: signals.length };
    },
    refetchInterval: 60 * 1000, // 60s
  });
}
