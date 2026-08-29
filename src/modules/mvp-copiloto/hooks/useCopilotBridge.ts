/**
 * Ponte com a extensão "Julia Companion": handshake, status da sessão
 * ChatGPT Pro e streaming da resposta — tudo por window.postMessage.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_MODEL,
  HANDSHAKE_TIMEOUT_MS,
  REQ,
  isBridgeResponse,
  newRequestId,
  type BridgeRequest,
  type BridgeResponse,
  type BridgeSessionInfo,
} from '../lib/bridgeProtocol';

export type BridgeState = 'checking' | 'missing' | 'logged_out' | 'connected';

function send(req: BridgeRequest) {
  window.postMessage(req, window.location.origin);
}

export function useCopilotBridge() {
  const [state, setState] = useState<BridgeState>('checking');
  const [version, setVersion] = useState<string | null>(null);
  const [session, setSession] = useState<BridgeSessionInfo | null>(null);

  const [streaming, setStreaming] = useState(false);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState<string | null>(null);

  const askIdRef = useRef<string | null>(null);
  const pingIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  // Listener único de respostas da extensão.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      const data = event.data as BridgeResponse;
      if (!isBridgeResponse(data)) return;

      if (data.type === 'PONG' && data.id === pingIdRef.current) {
        setVersion(data.version ?? null);
        // Extensão presente: pedir o status da sessão.
        const id = newRequestId();
        sessionIdRef.current = id;
        send({ source: REQ, id, action: 'SESSION' });
        return;
      }

      if (data.type === 'SESSION' && data.id === sessionIdRef.current) {
        setSession(data.session ?? null);
        setState(data.session?.loggedIn && data.session?.hasAccessToken ? 'connected' : 'logged_out');
        return;
      }

      if (data.id !== askIdRef.current) return;

      if (data.type === 'DELTA') {
        setAnswer(data.text ?? '');
      } else if (data.type === 'DONE') {
        if (data.text) setAnswer(data.text);
        setStreaming(false);
      } else if (data.type === 'ERROR') {
        setError(data.error || 'Erro desconhecido na extensão.');
        setStreaming(false);
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const check = useCallback(() => {
    setState('checking');
    setVersion(null);
    setSession(null);
    const id = newRequestId();
    pingIdRef.current = id;
    send({ source: REQ, id, action: 'PING' });

    window.setTimeout(() => {
      setState((prev) => (prev === 'checking' ? 'missing' : prev));
    }, HANDSHAKE_TIMEOUT_MS);
  }, []);

  // Handshake inicial e ao voltar para a aba (útil após logar no ChatGPT).
  useEffect(() => {
    check();
    const onFocus = () => check();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [check]);

  const ask = useCallback(
    (prompt: string, model: string = DEFAULT_MODEL) => {
      const id = newRequestId();
      askIdRef.current = id;
      setAnswer('');
      setError(null);
      setStreaming(true);
      send({ source: REQ, id, action: 'ASK', payload: { prompt, model } });
    },
    [],
  );

  const reset = useCallback(() => {
    askIdRef.current = null;
    setAnswer('');
    setError(null);
    setStreaming(false);
  }, []);

  return { state, version, session, check, ask, reset, streaming, answer, error };
}
