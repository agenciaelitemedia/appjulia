import { supabase } from '@/integrations/supabase/client';
import { renderProtocolMaskPreview } from './mask';

const DEFAULT_MASK = 'AAAAMMDDNNNNNN';

export type ProtocolScope = 'support_ticket';

async function fetchSupportMask(): Promise<string> {
  const { data } = await supabase
    .from('support_settings')
    .select('protocol_mask')
    .eq('id', 'global')
    .maybeSingle();
  const mask = (data as any)?.protocol_mask;
  return typeof mask === 'string' && mask.trim() ? mask : DEFAULT_MASK;
}

/**
 * Serviço único para geração e preview de protocolos.
 * Geração real usa RPC `generate_ticket_protocol` (atômica via ON CONFLICT no Postgres).
 * Preview NÃO consome sequencial.
 */
export const protocolService = {
  preview(mask: string, seq = 1, now = new Date()): string {
    return renderProtocolMaskPreview(mask, seq, now);
  },

  /** Gera protocolo real consumindo sequencial. */
  async generate(mask: string): Promise<string | null> {
    const safe = mask && mask.trim() ? mask : DEFAULT_MASK;
    const { data, error } = await supabase.rpc('generate_ticket_protocol', { p_mask: safe } as any);
    if (error) {
      console.warn('[protocolService] generate failed:', error.message);
      return null;
    }
    return (data as unknown as string) ?? null;
  },

  /** Carrega a máscara salva em support_settings e gera. */
  async generateForSupportTicket(): Promise<string | null> {
    try {
      const mask = await fetchSupportMask();
      return await this.generate(mask);
    } catch (e) {
      console.warn('[protocolService] generateForSupportTicket failed:', e);
      return null;
    }
  },
};

export { renderProtocolMaskPreview };