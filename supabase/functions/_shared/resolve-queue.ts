// ─── Shared helper: resolve queue_id from various sources ────────
// Used by meta-webhook, instagram-webhook, webchat-api
// to enrich conversations with queue_id

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * Resolve queue_id by looking up queue_agent_links for a given cod_agent.
 * Returns the primary queue (or first available) queue_id.
 */
export async function resolveQueueId(
  supabase: SupabaseClient,
  codAgent: string,
  channelType?: string,
): Promise<string | null> {
  try {
    // Try to find a queue linked to this agent, preferring primary + matching channel
    let query = supabase
      .from('queue_agent_links')
      .select('queue_id, is_primary, queues!inner(id, channel_type, is_active, is_deleted)')
      .eq('cod_agent', codAgent);

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      return null;
    }

    // Filter to active, non-deleted queues
    const active = data.filter((d: any) => d.queues?.is_active && !d.queues?.is_deleted);
    if (active.length === 0) return null;

    // Prefer matching channel_type + primary
    if (channelType) {
      const channelMatch = active.filter((d: any) => d.queues?.channel_type === channelType);
      if (channelMatch.length > 0) {
        const primary = channelMatch.find((d: any) => d.is_primary);
        return primary?.queue_id || channelMatch[0].queue_id;
      }
    }

    // Fallback to any primary queue
    const primary = active.find((d: any) => d.is_primary);
    return primary?.queue_id || active[0].queue_id;
  } catch (err) {
    console.error('[resolveQueueId] Error:', err);
    return null;
  }
}

/**
 * Resolve queue_id directly from a waba_number_id.
 * Looks for a queue with matching waba_number_id.
 */
export async function resolveQueueByWabaNumberId(
  supabase: SupabaseClient,
  wabaNumberId: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('queues')
      .select('id')
      .eq('waba_number_id', wabaNumberId)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .limit(1)
      .single();

    if (error || !data) return null;
    return data.id;
  } catch {
    return null;
  }
}

/**
 * Resolve queue_id from instagram_config's queue_id field.
 */
export async function resolveQueueByInstagramPageId(
  supabase: SupabaseClient,
  pageId: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('instagram_config')
      .select('queue_id')
      .eq('instagram_page_id', pageId)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (error || !data?.queue_id) return null;
    return data.queue_id;
  } catch {
    return null;
  }
}

/**
 * Resolve queue_id from webchat_config's queue_id field.
 */
export async function resolveQueueByWebchatAgent(
  supabase: SupabaseClient,
  codAgent: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('webchat_config')
      .select('queue_id')
      .eq('cod_agent', codAgent)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (error || !data?.queue_id) return null;
    return data.queue_id;
  } catch {
    return null;
  }
}
