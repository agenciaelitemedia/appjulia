import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface NotificationRecipient {
  id: string;
  notification_id: string;
  user_id: string;
  user_name: string | null;
  user_role: string | null;
  client_id: string | null;
  read_at: string | null;
  responded_at: string | null;
  poll_choice: string | null;
  response_text: string | null;
  dismissed: boolean;
  delivered_at: string | null;
}

export interface NotificationReport {
  recipients: NotificationRecipient[];
  total: number;
  readCount: number;
  respondedCount: number;
  pollTally: Record<string, number>; // opção -> contagem
}

export function useNotificationReport(notificationId: string | null) {
  return useQuery({
    queryKey: ['notification-report', notificationId],
    enabled: !!notificationId,
    queryFn: async (): Promise<NotificationReport> => {
      const { data, error } = await supabase
        .from('internal_notification_recipients')
        .select('*')
        .eq('notification_id', notificationId!)
        .order('read_at', { ascending: false, nullsFirst: false });
      if (error) throw error;
      const recipients = (data || []) as NotificationRecipient[];

      const pollTally: Record<string, number> = {};
      let readCount = 0;
      let respondedCount = 0;
      for (const r of recipients) {
        if (r.read_at) readCount++;
        if (r.responded_at) respondedCount++;
        if (r.poll_choice) pollTally[r.poll_choice] = (pollTally[r.poll_choice] ?? 0) + 1;
      }

      return { recipients, total: recipients.length, readCount, respondedCount, pollTally };
    },
  });
}
