import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AuditEntry {
  id: string;
  client_id: string;
  actor_identifier: string | null;
  actor_name: string | null;
  actor_ip: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  before_state: any;
  after_state: any;
  metadata: any;
  severity: string;
  created_at: string;
}

export function useAuditLog(filter: { clientId?: string; resourceType?: string; severity?: string } = {}) {
  return useQuery({
    queryKey: ["audit-log", filter],
    queryFn: async () => {
      let q = supabase.from("chat_audit_log").select("*").order("created_at", { ascending: false }).limit(500);
      if (filter.clientId) q = q.eq("client_id", filter.clientId);
      if (filter.resourceType) q = q.eq("resource_type", filter.resourceType);
      if (filter.severity) q = q.eq("severity", filter.severity);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as AuditEntry[];
    },
  });
}

export function useLogAudit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: Partial<AuditEntry> & { client_id: string; action: string; resource_type: string }) => {
      const { error } = await supabase.from("chat_audit_log").insert(entry as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["audit-log"] }),
  });
}
