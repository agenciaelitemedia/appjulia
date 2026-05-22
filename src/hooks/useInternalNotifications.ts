import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type NotificationType = 'message' | 'poll' | 'question';
export type NotificationAudience = 'owners' | 'teams' | 'all';
export type NotificationStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'canceled';

export interface InternalNotification {
  id: string;
  title: string;
  body: string | null;
  type: NotificationType;
  poll_options: string[] | null;
  audience: NotificationAudience;
  scope: 'global' | 'office';
  created_by: string;
  created_by_name: string | null;
  created_by_client_id: string | null;
  status: NotificationStatus;
  scheduled_for: string | null;
  sent_at: string | null;
  recipients_total: number;
  created_at: string;
}

export interface CreateNotificationInput {
  title: string;
  body?: string;
  type: NotificationType;
  poll_options?: string[];
  audience: NotificationAudience;
  scheduledFor?: string | null; // ISO; null/undefined = enviar agora
}

export function useInternalNotifications() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['internal-notifications', user?.id, isAdmin],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from('internal_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      // Admin vê todas; donos veem apenas as criadas por eles.
      if (!isAdmin && user?.id != null) q = q.eq('created_by', String(user.id));
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as InternalNotification[];
    },
  });

  const createAndSend = useMutation({
    mutationFn: async (input: CreateNotificationInput) => {
      if (!user) throw new Error('Sem usuário autenticado');
      const scheduled = !!input.scheduledFor;
      const payload = {
        title: input.title,
        body: input.body ?? null,
        type: input.type,
        poll_options: input.type === 'poll' ? (input.poll_options ?? []) : null,
        audience: input.audience,
        scope: isAdmin ? 'global' : 'office',
        created_by: String(user.id),
        created_by_name: user.name ?? null,
        created_by_client_id: user.client_id != null ? String(user.client_id) : null,
        status: scheduled ? 'scheduled' : 'draft',
        scheduled_for: input.scheduledFor ?? null,
      };
      const { data, error } = await supabase
        .from('internal_notifications')
        .insert(payload)
        .select('id')
        .single();
      if (error) throw error;

      // Enviar agora → dispara o dispatcher imediatamente.
      if (!scheduled && data?.id) {
        const { error: dErr } = await supabase.functions.invoke('internal-notification-dispatch', {
          body: { notification_id: data.id },
        });
        if (dErr) throw dErr;
      }
      return data?.id as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-notifications'] });
    },
  });

  return { notifications, isLoading, createAndSend };
}
