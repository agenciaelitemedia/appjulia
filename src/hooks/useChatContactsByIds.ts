import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ChatContact } from '@/types/chat';

const CHUNK_SIZE = 200;

/**
 * Loads `chat_contacts` rows by id in chunks of 200 (parallel queries).
 * Chunking keeps each `IN (...)` clause small and lets React Query cache
 * stable chunks independently — adding new ids only refetches the new chunk.
 */
export function useChatContactsByIds(ids: string[]) {
  // Stable chunk list — sort + dedupe + join into a memo key so identity only
  // changes when the actual id set changes (prevents useQueries thrashing).
  const idsKey = useMemo(() => [...new Set(ids)].sort().join(','), [ids]);

  const chunks = useMemo(() => {
    const sorted = idsKey ? idsKey.split(',') : [];
    const out: string[][] = [];
    for (let i = 0; i < sorted.length; i += CHUNK_SIZE) {
      out.push(sorted.slice(i, i + CHUNK_SIZE));
    }
    return out;
  }, [idsKey]);

  const queries = useMemo(() => {
    // Always include at least one disabled placeholder query — passing
    // `queries: []` to useQueries trips an internal React Query state bug
    // ("Cannot read properties of undefined (reading 'next')").
    if (chunks.length === 0) {
      return [{
        queryKey: ['chat-contacts-by-ids', '__noop__'],
        enabled: false,
        queryFn: async () => [] as ChatContact[],
      }];
    }
    return chunks.map((chunk) => ({
      queryKey: ['chat-contacts-by-ids', chunk.join(',')],
      enabled: chunk.length > 0,
      staleTime: 30_000,
      queryFn: async () => {
        const { data, error } = await supabase
          .from('chat_contacts')
          .select(
            'id, client_id, cod_agent, channel_source, channel_type, remote_jid, phone, name, avatar, is_group, is_archived, is_muted, unread_count, last_message_at, last_message_text, created_at, updated_at'
          )
          .in('id', chunk);
        if (error) throw error;
        return (data || []) as unknown as ChatContact[];
      },
    }));
  }, [chunks]);

  const results = useQueries({ queries });

  const data = useMemo(() => {
    const flat: ChatContact[] = [];
    for (const r of results) {
      if (r.data) flat.push(...r.data);
    }
    return flat;
  }, [results]);

  const isLoading = results.some((r) => r.isLoading);
  const isFetching = results.some((r) => r.isFetching);
  const error = results.find((r) => r.error)?.error;

  return { data, isLoading, isFetching, error } as const;
}