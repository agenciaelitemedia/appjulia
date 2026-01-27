import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { externalDb } from "@/lib/externalDb";
import { useAuth } from "@/contexts/AuthContext";
import { TeamMember, PrincipalUser, PrincipalUserAgent } from "../types";
import { toast } from "sonner";
import bcrypt from "bcryptjs";

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
      return externalDb.getTeamMembers(user.id, user.role === "admin");
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
      return externalDb.getUserAgentsForPrincipal(principalUserId);
    },
    enabled: !!principalUserId,
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
      agentIds: { agentId: number; codAgent: string }[];
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
      agentIds: { agentId: number; codAgent: string }[];
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

  return useMutation({
    mutationFn: async (memberId: number) => {
      return externalDb.deleteTeamMember(memberId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast.success("Membro removido com sucesso!");
    },
    onError: (error) => {
      console.error("Error deleting team member:", error);
      toast.error("Erro ao remover membro da equipe");
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
