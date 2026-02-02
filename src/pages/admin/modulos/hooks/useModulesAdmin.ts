import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import { toast } from 'sonner';
import type { Module } from '@/types/permissions';

export interface ModuleFormData {
  code: string;
  name: string;
  description?: string;
  category: string;
  icon?: string;
  route?: string;
  menu_group?: string;
  is_menu_visible: boolean;
  display_order: number;
  is_active: boolean;
}

export function useModulesAdmin() {
  const queryClient = useQueryClient();
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: modules = [], isLoading, error } = useQuery({
    queryKey: ['admin-modules'],
    queryFn: () => externalDb.getModules(),
  });

  const createMutation = useMutation({
    mutationFn: (moduleData: ModuleFormData) => 
      externalDb.createModule(moduleData as unknown as Partial<Module>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
      queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
      toast.success('Módulo criado com sucesso');
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar módulo: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ moduleId, moduleData }: { moduleId: number; moduleData: ModuleFormData }) =>
      externalDb.updateModule(moduleId, moduleData as unknown as Partial<Module>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
      queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
      toast.success('Módulo atualizado com sucesso');
      setIsDialogOpen(false);
      setSelectedModule(null);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar módulo: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (moduleId: number) => externalDb.deleteModule(moduleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
      queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
      toast.success('Módulo desativado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao desativar módulo: ${error.message}`);
    },
  });

  const migrateMutation = useMutation({
    mutationFn: () => externalDb.migrateModulesSchema(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
      queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
      toast.success(data.message || 'Schema migrado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro na migração: ${error.message}`);
    },
  });

  const openCreateDialog = () => {
    setSelectedModule(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (module: Module) => {
    setSelectedModule(module);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setSelectedModule(null);
  };

  return {
    modules,
    isLoading,
    error,
    selectedModule,
    isDialogOpen,
    openCreateDialog,
    openEditDialog,
    closeDialog,
    createModule: createMutation.mutate,
    updateModule: updateMutation.mutate,
    deleteModule: deleteMutation.mutate,
    migrateSchema: migrateMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isMigrating: migrateMutation.isPending,
  };
}
