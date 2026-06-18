import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type BulkCloseScope = 'all' | 'julia' | 'human';

export interface BulkCloseFilters {
  client_id: string;
  start: string;
  end: string;
  scope: BulkCloseScope;
  queue_id?: string | null;
  actor_identifier?: string | null;
  actor_name?: string | null;
  actor_user_id?: number | null;
}

export interface BulkClosePreview {
  total: number;
  capped: boolean;
  byAssignment: { julia: number; human: number };
  byQueue: Record<string, number>;
  oldest: string | null;
  newest: string | null;
}

export interface BulkCloseCommitResult {
  batch_id: string;
  closed: number;
  skipped: number;
}

async function invoke<T>(payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('chat-bulk-close', { body: payload });
  if (error) throw error;
  if (data && (data as any).error) throw new Error((data as any).error);
  return data as T;
}

export function useBulkCloseConversations() {
  const qc = useQueryClient();

  const previewMutation = useMutation({
    mutationFn: (filters: BulkCloseFilters) =>
      invoke<BulkClosePreview>({ action: 'preview', ...filters }),
  });

  const commitMutation = useMutation({
    mutationFn: (filters: BulkCloseFilters) =>
      invoke<BulkCloseCommitResult>({ action: 'commit', ...filters }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat-conversations'] });
      qc.invalidateQueries({ queryKey: ['chat-conversation-list'] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  return { previewMutation, commitMutation };
}
