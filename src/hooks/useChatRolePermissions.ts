import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface RolePermission {
  id: string;
  client_id: string;
  role_name: string;
  description: string | null;
  permissions: Record<string, boolean>;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export const PERMISSION_KEYS = [
  { key: "chat.view", label: "Visualizar conversas" },
  { key: "chat.send", label: "Enviar mensagens" },
  { key: "chat.assign", label: "Atribuir conversas" },
  { key: "chat.resolve", label: "Resolver/encerrar" },
  { key: "chat.delete", label: "Excluir conversas" },
  { key: "campaign.create", label: "Criar campanhas" },
  { key: "campaign.send", label: "Disparar campanhas" },
  { key: "kb.edit", label: "Editar base de conhecimento" },
  { key: "automation.edit", label: "Editar automações" },
  { key: "audit.view", label: "Ver auditoria" },
  { key: "lgpd.manage", label: "Gerenciar LGPD" },
  { key: "settings.edit", label: "Editar configurações" },
] as const;

export function useRolePermissions(clientId?: string) {
  return useQuery({
    queryKey: ["role-permissions", clientId],
    queryFn: async () => {
      let q = supabase.from("chat_role_permissions").select("*").order("role_name");
      if (clientId) q = q.eq("client_id", clientId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as RolePermission[];
    },
  });
}

export function useUpsertRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<RolePermission> & { client_id: string; role_name: string }) => {
      const { data, error } = await supabase
        .from("chat_role_permissions")
        .upsert(payload as any, { onConflict: "client_id,role_name" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["role-permissions"] });
      toast.success("Papel salvo");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chat_role_permissions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["role-permissions"] });
      toast.success("Papel removido");
    },
  });
}
