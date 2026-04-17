import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ChatCallLog {
  id: string;
  client_id: string;
  conversation_id: string | null;
  contact_id: string | null;
  agent_identifier: string | null;
  direction: string;
  status: string;
  provider: string | null;
  from_number: string | null;
  to_number: string | null;
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  duration_seconds: number;
  recording_url: string | null;
  transcription: string | null;
  notes: string | null;
}

export function useChatCallLogs(filter: { clientId?: string; conversationId?: string } = {}) {
  return useQuery({
    queryKey: ["chat-call-logs", filter],
    queryFn: async () => {
      let q = supabase.from("chat_call_logs").select("*").order("started_at", { ascending: false }).limit(200);
      if (filter.clientId) q = q.eq("client_id", filter.clientId);
      if (filter.conversationId) q = q.eq("conversation_id", filter.conversationId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as ChatCallLog[];
    },
  });
}

export function useCreateCallLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<ChatCallLog> & { client_id: string }) => {
      const { data, error } = await supabase.from("chat_call_logs").insert(payload as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-call-logs"] });
      toast.success("Chamada registrada");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateCallLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<ChatCallLog> & { id: string }) => {
      const { data, error } = await supabase.from("chat_call_logs").update(patch as any).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat-call-logs"] }),
  });
}
