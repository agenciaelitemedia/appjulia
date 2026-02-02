import { useQuery } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import { useAuth } from '@/contexts/AuthContext';
import type { Module } from '@/types/permissions';

export interface MenuModule extends Module {
  icon?: string;
  route?: string;
  menu_group?: string;
  is_menu_visible?: boolean;
}

export interface GroupedMenuModules {
  [groupName: string]: MenuModule[];
}

export function useMenuModules() {
  const { isAdmin, hasPermission, user } = useAuth();

  const { data: modules = [], isLoading, error } = useQuery({
    queryKey: ['menu-modules'],
    queryFn: () => externalDb.getMenuModules(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!user,
  });

  // Filter modules based on permissions
  const filteredModules = modules.filter((mod: MenuModule) => {
    // Only show visible modules
    if (!mod.is_menu_visible) return false;
    
    // Admin sees all
    if (isAdmin) return true;
    
    // Check if user has view permission for this module
    return hasPermission(mod.code as any, 'view');
  });

  // Group modules by menu_group
  const groupedModules = filteredModules.reduce<GroupedMenuModules>((acc, mod) => {
    const group = mod.menu_group || 'OUTROS';
    if (!acc[group]) acc[group] = [];
    acc[group].push(mod);
    return acc;
  }, {});

  // Sort modules within each group by display_order
  Object.keys(groupedModules).forEach(group => {
    groupedModules[group].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  });

  return {
    modules: filteredModules,
    groupedModules,
    isLoading,
    error,
  };
}

// Define the order of menu groups
export const menuGroupOrder = [
  'PRINCIPAL',
  'AGENTES DA JULIA',
  'CRM',
  'SISTEMA',
  'ADMINISTRATIVO',
  'FINANCEIRO',
  'CONFIGURAÇÕES',
];

export function getSortedGroups(groupedModules: GroupedMenuModules): [string, MenuModule[]][] {
  const entries = Object.entries(groupedModules);
  
  return entries.sort(([groupA], [groupB]) => {
    const indexA = menuGroupOrder.indexOf(groupA);
    const indexB = menuGroupOrder.indexOf(groupB);
    
    // Unknown groups go at the end
    const orderA = indexA === -1 ? 999 : indexA;
    const orderB = indexB === -1 ? 999 : indexB;
    
    return orderA - orderB;
  });
}
