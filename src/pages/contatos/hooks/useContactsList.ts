import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ContactRow {
  id: string;
  name: string;
  phone: string;
  avatar: string | null;
  channel_source: string | null;
  queue_name: string | null;
  channel_type: string;
  is_group: boolean | null;
  last_message_at: string | null;
  last_message_text: string | null;
  unread_count: number | null;
  created_at: string | null;
}

export function useContactsList(isGroup: boolean) {
  const { user } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : '';

  return useQuery({
    queryKey: ['contacts-list', clientId, isGroup],
    enabled: !!clientId,
    queryFn: async (): Promise<ContactRow[]> => {
      const { data, error } = await supabase
        .from('chat_contacts')
        .select('id,name,phone,avatar,channel_source,channel_type,is_group,last_message_at,last_message_text,unread_count,created_at')
        .eq('client_id', clientId)
        .eq('is_group', isGroup)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(5000);
      if (error) throw error;
      const rows = (data ?? []) as ContactRow[];
      const queueIds = Array.from(
        new Set(rows.map((r) => r.channel_source).filter((v): v is string => !!v))
      );
      let nameById = new Map<string, string>();
      if (queueIds.length) {
        const { data: queues } = await supabase
          .from('queues')
          .select('id,name')
          .in('id', queueIds);
        nameById = new Map((queues ?? []).map((q: any) => [String(q.id), q.name as string]));
      }
      return rows.map((r) => ({
        ...r,
        queue_name: r.channel_source ? nameById.get(r.channel_source) ?? null : null,
      }));
    },
  });
}

export function useContactsCount() {
  const { user } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : '';

  return useQuery({
    queryKey: ['contacts-counts', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const [contactsRes, groupsRes] = await Promise.all([
        supabase
          .from('chat_contacts')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', clientId)
          .eq('is_group', false),
        supabase
          .from('chat_contacts')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', clientId)
          .eq('is_group', true),
      ]);
      return {
        contacts: contactsRes.count ?? 0,
        groups: groupsRes.count ?? 0,
      };
    },
  });
}