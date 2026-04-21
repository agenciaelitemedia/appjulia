import { supabase } from '@/integrations/supabase/client';

/**
 * Ensures a chat_client_settings row exists for the given client_id.
 * Creates with safe defaults if missing. Fails silently to never break agent flows.
 */
export async function ensureChatClientSettings(
  clientId: number | string | null | undefined,
  clientName?: string | null,
  clientBusinessName?: string | null,
): Promise<void> {
  if (clientId === null || clientId === undefined || clientId === '') return;
  const cid = String(clientId);

  try {
    const { data: existing, error: selErr } = await supabase
      .from('chat_client_settings')
      .select('id')
      .eq('client_id', cid)
      .maybeSingle();

    if (selErr) {
      console.warn('[ensureChatClientSettings] select error:', selErr);
      return;
    }
    if (existing) return;

    const { error: insErr } = await supabase.from('chat_client_settings').insert({
      client_id: cid,
      client_name: clientName ?? null,
      client_business_name: clientBusinessName ?? null,
      settings: { QUEUE_LIMIT: 1, ALLOW_GROUPS: false } as any,
    });
    if (insErr) {
      console.warn('[ensureChatClientSettings] insert error:', insErr);
    }
  } catch (e) {
    console.warn('[ensureChatClientSettings] unexpected error:', e);
  }
}