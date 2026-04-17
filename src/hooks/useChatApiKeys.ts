import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ChatApiKey {
  id: string;
  client_id: string;
  cod_agent: string | null;
  name: string;
  key_prefix: string;
  scopes: string[];
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function genKey(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  const b64 = btoa(String.fromCharCode(...arr)).replace(/[+/=]/g, '');
  return `cak_${b64}`;
}

export function useChatApiKeys(clientId: string | null) {
  return useQuery({
    queryKey: ['chat-api-keys', clientId],
    queryFn: async (): Promise<ChatApiKey[]> => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('chat_api_keys')
        .select('id, client_id, cod_agent, name, key_prefix, scopes, is_active, last_used_at, created_at, expires_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });
}

export function useCreateChatApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientId, codAgent, name, scopes }: { clientId: string; codAgent?: string | null; name: string; scopes: string[] }) => {
      const key = genKey();
      const hash = await sha256(key);
      const { data, error } = await supabase
        .from('chat_api_keys')
        .insert({
          client_id: clientId,
          cod_agent: codAgent ?? null,
          name,
          key_hash: hash,
          key_prefix: key.slice(0, 12),
          scopes,
        })
        .select()
        .single();
      if (error) throw error;
      return { row: data, plainKey: key };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat-api-keys'] });
      toast.success('Chave criada');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useToggleChatApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('chat_api_keys').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-api-keys'] }),
  });
}

export function useDeleteChatApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('chat_api_keys').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat-api-keys'] });
      toast.success('Chave removida');
    },
  });
}
