import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type LgpdType = "export" | "anonymize" | "delete";
export type LgpdStatus = "pending" | "processing" | "completed" | "rejected";

export interface LgpdRequest {
  id: string;
  client_id: string;
  contact_id: string | null;
  contact_phone: string | null;
  request_type: LgpdType;
  status: LgpdStatus;
  requested_by: string | null;
  reason: string | null;
  result_url: string | null;
  processed_at: string | null;
  notes: string | null;
  created_at: string;
}

export function useLgpdRequests(clientId?: string) {
  return useQuery({
    queryKey: ["lgpd-requests", clientId],
    queryFn: async () => {
      let q = supabase.from("chat_lgpd_requests").select("*").order("created_at", { ascending: false });
      if (clientId) q = q.eq("client_id", clientId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as LgpdRequest[];
    },
  });
}

export function useCreateLgpdRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<LgpdRequest> & { client_id: string; request_type: LgpdType }) => {
      const { data, error } = await supabase.from("chat_lgpd_requests").insert(payload as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lgpd-requests"] });
      toast.success("Solicitação LGPD registrada");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateLgpdRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<LgpdRequest> & { id: string }) => {
      const { data, error } = await supabase.from("chat_lgpd_requests").update(patch as any).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lgpd-requests"] }),
  });
}
