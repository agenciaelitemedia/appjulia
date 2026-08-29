/**
 * Análise do atendimento pelo caminho oficial: a Julia chama seu próprio
 * conector/gateway (Lovable AI) com um token curto emitido no servidor.
 * Nenhuma sessão ou cookie de terceiros é usada.
 */
import { useCallback, useRef, useState } from 'react';
import { ANALYZE_URL, requestSimulatorToken } from '../lib/copilotoApi';

const STORAGE_KEY = 'copiloto.sim.token';

export function useCopilotoAnalysis() {
  const [streaming, setStreaming] = useState(false);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const getToken = useCallback(async (email: string, password?: string) => {
    const cached = sessionStorage.getItem(STORAGE_KEY);
    if (cached) return cached;
    if (!password) throw new Error('NEED_PASSWORD');
    const token = await requestSimulatorToken(email, password);
    sessionStorage.setItem(STORAGE_KEY, token);
    return token;
  }, []);

  const analyze = useCallback(
    async (contactId: string, email: string, password?: string) => {
      setAnswer('');
      setError(null);
      setStreaming(true);
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const token = await getToken(email, password);
        const res = await fetch(ANALYZE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ contato_id: contactId }),
          signal: controller.signal,
        });

        if (res.status === 401) {
          sessionStorage.removeItem(STORAGE_KEY);
          throw new Error('Sessão do copiloto expirou. Informe a senha novamente.');
        }
        if (!res.ok || !res.body) {
          const detail = await res.json().catch(() => ({}));
          throw new Error(detail?.message || `Falha na análise (${res.status}).`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let text = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const payload = trimmed.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;
            try {
              const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
              if (delta) {
                text += delta;
                setAnswer(text);
              }
            } catch {
              /* chunk parcial */
            }
          }
        }

        if (!text) setError('A IA não retornou texto para esta conversa.');
      } catch (e) {
        const msg = (e as Error).message;
        if (msg !== 'NEED_PASSWORD' && msg !== 'AbortError') setError(msg);
        if (msg === 'NEED_PASSWORD') throw e;
      } finally {
        setStreaming(false);
      }
    },
    [getToken],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setAnswer('');
    setError(null);
    setStreaming(false);
  }, []);

  const hasToken = () => !!sessionStorage.getItem(STORAGE_KEY);

  return { analyze, reset, streaming, answer, error, hasToken };
}
