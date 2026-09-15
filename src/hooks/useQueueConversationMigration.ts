import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type QueueMigrationStatus = 'pending' | 'open' | 'resolved' | 'closed';

export interface QueueMigrationInput {
  client_id: string;
  from_queue_id: string;
  to_queue_id: string;
  statuses: QueueMigrationStatus[];
  start?: string | null;
  end?: string | null;
  /** 'all' | 'unassigned' | nome do responsável */
  assigned_filter: string;
  assignee_mode: 'keep' | 'return_queue';
  move_contacts: boolean;
  actor_name?: string | null;
  actor_user_id?: number | null;
}

export interface QueueMigrationAnalysis {
  total: number;
  capped: boolean;
  byStatus: Record<string, number>;
  byAssignee: Record<string, number>;
  contacts: number;
  oldest: string | null;
  newest: string | null;
}

export interface QueueMigrationResult {
  batch_id: string;
  migrated: number;
  skipped: number;
  analyzed: number;
  contacts_moved: number;
}

async function invoke<T>(action: string, data: QueueMigrationInput): Promise<T> {
  const { data: result, error } = await supabase.functions.invoke('queue-management', {
    body: { action, data },
  });
  if (error) throw new Error(error.message || 'Falha ao chamar a gestão de filas');
  if (result && (result as any).error) throw new Error((result as any).error);
  return result as T;
}

export function useQueueConversationMigration() {
  const qc = useQueryClient();

  const analyzeMutation = useMutation({
    mutationFn: (input: QueueMigrationInput) =>
      invoke<QueueMigrationAnalysis>('migrate_conversations_analyze', input),
  });

  const commitMutation = useMutation({
    mutationFn: (input: QueueMigrationInput) =>
      invoke<QueueMigrationResult>('migrate_conversations_commit', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queues'] });
      qc.invalidateQueries({ queryKey: ['chat-conversations'] });
      qc.invalidateQueries({ queryKey: ['chat-conversation-list'] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['chat-list-feed'] });
      qc.invalidateQueries({ queryKey: ['chat-assigned-counts'] });
    },
  });

  return { analyzeMutation, commitMutation };
}
