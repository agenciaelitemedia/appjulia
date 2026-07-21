import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { blitzSupabase, BLITZ_TABLES } from "@/blitzleads/lib/blitzClient";

export type BlitzCaseStatus = "parou" | "objecao" | "qualificado" | "nao_assinado" | "assinado";

export interface BlitzCase {
  id: string;
  contact_name: string;
  phone: string | null;
  product: string | null;
  subject: string | null;
  status: BlitzCaseStatus;
  priority: number;
  sla_deadline: string | null;
  score: number;
  next_action: string | null;
  assigned_to: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export function useBlitzCases(status?: BlitzCaseStatus | "all") {
  return useQuery({
    queryKey: ["blitzleads", "cases", status ?? "all"],
    queryFn: async (): Promise<BlitzCase[]> => {
      let query = (blitzSupabase as any)
        .from(BLITZ_TABLES.cases)
        .select("*")
        .order("priority", { ascending: false })
        .order("sla_deadline", { ascending: true, nullsFirst: false });
      if (status && status !== "all") query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as BlitzCase[];
    },
    staleTime: 15_000,
  });
}

export function useUpdateBlitzCaseStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: BlitzCaseStatus }) => {
      const { error } = await (blitzSupabase as any)
        .from(BLITZ_TABLES.cases)
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blitzleads", "cases"] });
    },
  });
}