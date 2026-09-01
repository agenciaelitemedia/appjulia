import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type BulkTransferStatus = 'open' | 'pending';

export interface BulkTransferTarget {
  type: 'assign' | 'return_queue';
  assigned_to?: string | null;
  assigned_user_id?: number | null;
}

export interface BulkTransferFilters {
  client_id: string;
  start?: string | null;
  end?: string | null;
  queue_id?: string | null;
  /** 'all' | 'unassigned' | nome do responsável atual */
  current_assignee?: string | null;
  statuses: BulkTransferStatus[];
  target: BulkTransferTarget;
  actor_name?: string | null;
  actor_user_id?: number | null;
}

export interface BulkTransferPreview {
  total: number;
  capped: boolean;
  byQueue: Record<string, number>;
  byAssignee: Record<string, number>;
  oldest: string | null;
  newest: string | null;
}

export interface BulkTransferCommitResult {
  batch_id: string;
  transferred: number;
  skipped: number;
}

async function invoke<T>(payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('chat-bulk-transfer', { body: payload });
  if (error) throw error;
  if (data && (data as any).error) throw new Error((data as any).error);
  return data as T;
}

export function useBulkTransferConversations() {
  const qc = useQueryClient();

  const previewMutation = useMutation({
    mutationFn: (filters: BulkTransferFilters) =>
      invoke<BulkTransferPreview>({ action: 'preview', ...filters }),
  });

  const commitMutation = useMutation({
    mutationFn: (filters: BulkTransferFilters) =>
      invoke<BulkTransferCommitResult>({ action: 'commit', ...filters }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat-conversations'] });
      qc.invalidateQueries({ queryKey: ['chat-conversation-list'] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['chat-list-feed'] });
      qc.invalidateQueries({ queryKey: ['chat-assigned-counts'] });
    },
  });

  return { previewMutation, commitMutation };
}
