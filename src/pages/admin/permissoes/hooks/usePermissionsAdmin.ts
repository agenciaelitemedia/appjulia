import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import type { Module, UserPermission, PermissionUpdate, AppRole } from '@/types/permissions';
import type { UserWithPermissions } from '../types';
import { toast } from '@/hooks/use-toast';
import bcrypt from 'bcryptjs';

// Fetch users with permissions info
export function useUsersWithPermissions(roleFilter?: string) {
  return useQuery({
    queryKey: ['users-with-permissions', roleFilter],
    queryFn: () => externalDb.getUsersWithPermissions(roleFilter),
  });
}

// Fetch permissions for a specific user
export function useUserPermissions(userId: number | null) {
  return useQuery({
    queryKey: ['user-permissions', userId],
    queryFn: () => externalDb.getUserPermissions(userId!),
    enabled: !!userId,
  });
}

// Fetch all modules
export function useModules() {
  return useQuery({
    queryKey: ['modules'],
    queryFn: () => externalDb.getModules(),
  });
}

// Fetch default permissions for a role
export function useRoleDefaultPermissions(role: AppRole | null) {
  return useQuery({
    queryKey: ['role-default-permissions', role],
    queryFn: () => externalDb.getRoleDefaultPermissions(role!),
    enabled: !!role,
  });
}

// Mutation: update user permissions
export function useUpdateUserPermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      permissions,
      useCustom,
    }: {
      userId: number;
      permissions: PermissionUpdate[];
      useCustom: boolean;
    }) => {
      return externalDb.updateUserPermissions(userId, permissions, useCustom);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-permissions', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['users-with-permissions'] });
      toast({
        title: 'Permissões atualizadas',
        description: 'As permissões do usuário foram salvas com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao atualizar permissões',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Mutation: update role default permissions
export function useUpdateRoleDefaultPermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      role,
      permissions,
    }: {
      role: AppRole;
      permissions: PermissionUpdate[];
    }) => {
      return externalDb.updateRoleDefaultPermissions(role, permissions);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['role-default-permissions', variables.role] });
      queryClient.invalidateQueries({ queryKey: ['user-permissions'] });
      toast({
        title: 'Permissões padrão atualizadas',
        description: `As permissões padrão do cargo "${variables.role}" foram salvas.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao atualizar permissões padrão',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Mutation: update user profile
export function useUpdateUserProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      userId: number;
      name: string;
      email: string;
      role: AppRole;
      isActive: boolean;
    }) => {
      return externalDb.updateUserProfile(data.userId, {
        name: data.name,
        email: data.email,
        role: data.role,
        isActive: data.isActive,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users-with-permissions'] });
      queryClient.invalidateQueries({ queryKey: ['user-permissions', variables.userId] });
      toast({
        title: 'Perfil atualizado',
        description: 'Os dados do usuário foram salvos com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao atualizar perfil',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Generate password in format Julia@XXXX
function generatePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `Julia@${suffix}`;
}

// Mutation: reset user password
export function useResetUserPassword() {
  return useMutation({
    mutationFn: async (userId: number) => {
      const rawPassword = generatePassword();
      const hashedPassword = await bcrypt.hash(rawPassword, 10);
      await externalDb.resetUserPassword(userId, hashedPassword, rawPassword);
      return { temporaryPassword: rawPassword };
    },
    onSuccess: () => {
      toast({
        title: 'Senha redefinida',
        description: 'A nova senha temporária foi gerada com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao redefinir senha',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
