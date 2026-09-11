import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { xjInvoke } from '@/modules/x-julia/lib/xjInvoke';

export type MemoryCategory = 'profile_context' | 'needs_case' | 'pains_objections' | 'agreements_commitments' | 'next_steps' | 'team_observations';

export interface ContactMemoryItem {
  id: string;
  category: MemoryCategory;
  content: string;
  source_type: 'message' | 'audio' | 'internal_note' | 'observation' | 'summary' | 'manual';
  source_message_id?: string | null;
  source_at?: string | null;
  source_author?: string | null;
  confidence?: number | null;
  created_by_name?: string | null;
  created_at: string;
}

export interface MemorySource {
  id: string;
  conversation_id?: string;
  text?: string;
  type: string;
  from_me: boolean;
  internal_note?: boolean;
  sender_name?: string;
  media_url?: string;
  file_name?: string;
  caption?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface MemoryDocument extends MemorySource {}

interface ContactMemoryData {
  can_edit: boolean;
  items: ContactMemoryItem[];
  sources: MemorySource[];
  documents: MemoryDocument[];
  summaries: Array<{ id: string; summary: string; atendimento?: string; sentiment?: string; created_at: string }>;
  state?: { last_generated_at?: string; last_processed_at?: string } | null;
}

async function invokeMemory<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await xjInvoke<T & { error?: string }>('chat-contact-memory', { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export function useContactMemory(contactId: string | null) {
  const queryClient = useQueryClient();
  const key = ['contact-memory', contactId];
  const query = useQuery({
    queryKey: key,
    enabled: Boolean(contactId),
    queryFn: () => invokeMemory<ContactMemoryData>({ action: 'list', contact_id: contactId, page_size: 100 }),
  });
  const action = useMutation({
    mutationFn: (body: Record<string, unknown>) => invokeMemory({ ...body, contact_id: contactId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  return { ...query, runAction: action.mutateAsync, isActing: action.isPending };
}