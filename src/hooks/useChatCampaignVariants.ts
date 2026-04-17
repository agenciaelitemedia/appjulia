import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CampaignVariant {
  id: string;
  campaign_id: string;
  label: string;
  message_text: string;
  media_type: string | null;
  media_url: string | null;
  weight: number;
  contacts_sent: number;
  contacts_delivered: number;
  contacts_replied: number;
  contacts_converted: number;
  created_at: string;
}

export function useCampaignVariants(campaignId?: string) {
  return useQuery({
    queryKey: ["campaign-variants", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_campaign_variants")
        .select("*")
        .eq("campaign_id", campaignId!)
        .order("created_at");
      if (error) throw error;
      return (data || []) as CampaignVariant[];
    },
  });
}

export function useCreateVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<CampaignVariant> & { campaign_id: string; label: string; message_text: string }) => {
      const { data, error } = await supabase.from("chat_campaign_variants").insert(payload as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["campaign-variants", v.campaign_id] });
      toast.success("Variante criada");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chat_campaign_variants").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign-variants"] });
      toast.success("Variante removida");
    },
  });
}
