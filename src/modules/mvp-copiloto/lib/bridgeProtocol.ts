/**
 * Protocolo de mensagens entre a página da Julia e a extensão "Julia Companion".
 * Este arquivo é a fonte de verdade — a extensão (extension/content.js e
 * extension/background.js) repete os mesmos nomes de evento.
 *
 * Direção:
 *   página  -> extensão : JULIA_COPILOT_REQ
 *   extensão -> página  : JULIA_COPILOT_RES
 */

export const REQ = 'JULIA_COPILOT_REQ' as const;
export const RES = 'JULIA_COPILOT_RES' as const;

export type BridgeAction = 'PING' | 'SESSION' | 'ASK';

export interface BridgeRequest {
  source: typeof REQ;
  id: string;
  action: BridgeAction;
  payload?: {
    /** Texto completo (contexto + comando) enviado para a conta Pro. */
    prompt?: string;
    /** Modelo do ChatGPT web (ex.: gpt-4o). */
    model?: string;
  };
}

export type BridgeResponseType = 'PONG' | 'SESSION' | 'DELTA' | 'DONE' | 'ERROR';

export interface BridgeSessionInfo {
  loggedIn: boolean;
  email: string | null;
  plan: string | null;
  hasAccessToken: boolean;
}

export interface BridgeResponse {
  source: typeof RES;
  id: string;
  type: BridgeResponseType;
  /** PONG */
  version?: string;
  /** SESSION */
  session?: BridgeSessionInfo;
  /** DELTA — texto acumulado até agora. */
  text?: string;
  /** ERROR */
  error?: string;
}

/** Tempo máximo de espera pelo PONG antes de considerar a extensão ausente. */
export const HANDSHAKE_TIMEOUT_MS = 1500;

/** Modelo padrão usado no MVP. */
export const DEFAULT_MODEL = 'gpt-4o';

export function newRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isBridgeResponse(data: unknown): data is BridgeResponse {
  return !!data && typeof data === 'object' && (data as any).source === RES;
}
