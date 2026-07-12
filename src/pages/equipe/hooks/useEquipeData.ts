import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { externalDb } from "@/lib/externalDb";
import { useAuth } from "@/contexts/AuthContext";
import { TeamMember, PrincipalUser, PrincipalUserAgent } from "../types";
import { UserPermission } from "@/types/permissions";
import { toast } from "sonner";
import bcrypt from "bcryptjs";
import { supabase } from "@/integrations/supabase/client";

function generatePassword(): string {
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `Julia@${digits}`;
}

export function useTeamMembers() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["team-members", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      // Usa a view vw_equipe para retornar somente membros do mesmo client_id
      // do usuário logado (resolvendo via parent quando necessário).
      const members = await externalDb.getTeamByClient<TeamMember>(
        user.id as number,
        String(user.role || "")
      );
      // Exclui o próprio usuário logado da lista
      return members.filter((m) => Number(m.id) !== Number(user.id));
    },
    enabled: !!user?.id,
  });
}

export function usePrincipalUsers() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["principal-users", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      return externalDb.getPrincipalUsers(user.id, user.role === "admin");
    },
    enabled: !!user?.id,
  });
}

export function usePrincipalUserAgents(principalUserId: number | null) {
  return useQuery({
    queryKey: ["principal-user-agents", principalUserId],
    queryFn: async () => {
      if (!principalUserId) return [];
      return externalDb.getUserAgentsForPrincipal<PrincipalUserAgent>(principalUserId);
    },
    enabled: !!principalUserId,
  });
}

export function useParentUserPermissions(parentUserId: number | null) {
  return useQuery({
    queryKey: ["parent-user-permissions", parentUserId],
    queryFn: async () => {
      if (!parentUserId) return [];
      return externalDb.getUserPermissions(parentUserId);
    },
    enabled: !!parentUserId,
  });
}

export function useCreateTeamMember() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      email: string;
      principalUserId: number;
      agentIds: { agentId: number | null; codAgent: string }[];
      modulePermissions: { moduleCode: string }[];
      role?: string;
    }) => {
      // Generate password
      const rawPassword = generatePassword();
      const hashedPassword = await bcrypt.hash(rawPassword, 10);

      // Get client_id from principal user
      const principalUser = await externalDb.raw<{ client_id: number }>({
        query: "SELECT client_id FROM users WHERE id = $1 LIMIT 1",
        params: [data.principalUserId],
      });

      const clientId = principalUser[0]?.client_id || null;

      // Insert team member
      const result = await externalDb.insertTeamMember({
        name: data.name,
        email: data.email,
        hashedPassword,
        rawPassword,
        principalUserId: data.principalUserId,
        clientId,
        agentIds: data.agentIds,
        modulePermissions: data.modulePermissions,
        role: data.role,
      });

      return { ...result, temporaryPassword: rawPassword };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast.success("Membro criado com sucesso!");
    },
    onError: (error) => {
      console.error("Error creating team member:", error);
      toast.error("Erro ao criar membro da equipe");
    },
  });
}

export function useUpdateTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      memberId: number;
      name: string;
      principalUserId: number;
      agentIds: { agentId: number | null; codAgent: string }[];
      modulePermissions: { moduleCode: string }[];
      role?: string;
    }) => {
      return externalDb.updateTeamMember(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast.success("Membro atualizado com sucesso!");
    },
    onError: (error) => {
      console.error("Error updating team member:", error);
      toast.error("Erro ao atualizar membro da equipe");
    },
  });
}

export function useDeleteTeamMember() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (member: number | { id: number; name?: string | null }) => {
      const memberId = typeof member === 'number' ? member : member.id;
      const memberName = typeof member === 'number' ? null : (member.name || null);
      const res: any = await externalDb.deleteTeamMember(memberId);
      // A edge function pode retornar { success: false, reason, message }
      const payload = Array.isArray(res) ? res[0] : res;
      if (payload && payload.success === false) {
        const err: any = new Error(payload.message || 'Não foi possível remover o membro.');
        err.reason = payload.reason;
        throw err;
      }

      // Limpeza de conversas no chat: desatribuir open/pending, encerrar resolved.
      let cleanup: { unassigned: number; closed: number } | null = null;
      const clientId = user?.client_id ? String(user.client_id) : '';
      if (memberName && clientId) {
        try {
          const { data, error } = await supabase.functions.invoke(
            'team-member-cleanup-conversations',
            { body: { clientId, memberName, memberId, actorName: user?.name } },
          );
          if (error) throw error;
          cleanup = data as { unassigned: number; closed: number };
        } catch (e) {
          console.warn('[useDeleteTeamMember] cleanup conversations failed', e);
          toast.warning('Membro removido, mas houve falha ao ajustar conversas atribuídas.');
        }
      }
      return { res, cleanup };
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      queryClient.invalidateQueries({ queryKey: ["chat-assigned-counts-by-member"] });
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      const c = result?.cleanup;
      if (c && (c.unassigned || c.closed)) {
        toast.success(
          `Membro removido. ${c.unassigned} conversa(s) devolvida(s) à fila, ${c.closed} encerrada(s).`,
        );
      } else {
        toast.success("Membro removido com sucesso!");
      }
    },
    onError: (error: any) => {
      console.error("Error deleting team member:", error);
      toast.error(error?.message || "Erro ao remover membro da equipe");
    },
  });
}

export function useResetTeamMemberPassword() {
  return useMutation({
    mutationFn: async (memberId: number) => {
      const rawPassword = generatePassword();
      const hashedPassword = await bcrypt.hash(rawPassword, 10);

      await externalDb.resetTeamMemberPassword(memberId, hashedPassword, rawPassword);

      return { temporaryPassword: rawPassword };
    },
    onSuccess: () => {
      toast.success("Senha redefinida com sucesso!");
    },
    onError: (error) => {
      console.error("Error resetting password:", error);
      toast.error("Erro ao redefinir senha");
    },
  });
}
