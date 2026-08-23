import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { WabaTemplateRow } from "./types";

export interface WabaQueue {
  id: string;
  name: string;
  waba_id: string | null;
  waba_number_id: string | null;
  phone_number: string | null;
}

export function useWabaQueues() {
  const { user } = useAuth();
  const clientId = user?.client_id != null ? String(user.client_id) : "";

  return useQuery<WabaQueue[]>({
    queryKey: ["waba-queues", clientId],
    enabled: !!clientId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("queues")
        .select("id, name, waba_id, waba_number_id, phone_number")
        .eq("client_id", clientId)
        .eq("channel_type", "waba")
        .eq("is_active", true)
        .eq("is_deleted", false)
        .order("name");
      if (error) throw error;
      return (data || []) as WabaQueue[];
    },
  });
}

export function useWabaTemplatesCache(queueId: string | null) {
  return useQuery<WabaTemplateRow[]>({
    queryKey: ["waba-templates", queueId],
    enabled: !!queueId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waba_templates" as any)
        .select("*")
        .eq("queue_id", queueId!)
        .order("last_edited_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as WabaTemplateRow[];
    },
  });
}

export function useSyncTemplates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (queueId: string) => {
      const { data, error } = await supabase.functions.invoke("waba-templates", {
        body: { action: "sync", queue_id: queueId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: (_d, queueId) => {
      qc.invalidateQueries({ queryKey: ["waba-templates", queueId] });
      toast.success("Templates sincronizados");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao sincronizar"),
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      queue_id: string;
      name: string;
      language: string;
      category: string;
      components: any[];
      allow_category_change?: boolean;
    }) => {
      const { data, error } = await supabase.functions.invoke("waba-templates", {
        body: { action: "create", ...payload },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["waba-templates", v.queue_id] });
      toast.success("Template enviado para análise da Meta");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao criar"),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { queue_id: string; name: string; hsm_id?: string }) => {
      const { data, error } = await supabase.functions.invoke("waba-templates", {
        body: { action: "delete", ...payload },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["waba-templates", v.queue_id] });
      toast.success("Template excluído");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao excluir"),
  });
}

export function useUploadMediaHandle() {
  return useMutation({
    mutationFn: async (payload: {
      queue_id: string;
      file: File;
    }): Promise<string> => {
      const file_base64 = await fileToBase64(payload.file);
      const { data, error } = await supabase.functions.invoke("waba-templates", {
        body: {
          action: "upload_media_handle",
          queue_id: payload.queue_id,
          file_base64,
          file_type: payload.file.type,
          file_name: payload.file.name,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return (data as any).handle as string;
    },
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      resolve(res.split(",")[1] || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}