/**
 * Auto-registro do módulo X-Julia na matriz de módulos/permissões.
 */
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { externalDb } from './db';
import { X_JULIA_MODULE } from '../module';

export function useEnsureXJuliaModule() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAdmin) return;

    (async () => {
      try {
        const modules = await externalDb.getModules();
        const existing = modules.find((m: any) => m.code === X_JULIA_MODULE.code);

        if (existing) {
          if (
            existing.route !== X_JULIA_MODULE.route ||
            !existing.is_menu_visible ||
            existing.menu_group !== X_JULIA_MODULE.menuGroup
          ) {
            await externalDb.updateModule(existing.id, {
              route: X_JULIA_MODULE.route,
              is_menu_visible: true,
              menu_group: X_JULIA_MODULE.menuGroup,
            });
            queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
            queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
          }
          return;
        }

        await externalDb.createModule({
          name: X_JULIA_MODULE.name,
          code: X_JULIA_MODULE.code as any,
          description: X_JULIA_MODULE.description,
          icon: X_JULIA_MODULE.icon,
          route: X_JULIA_MODULE.route,
          menu_group: X_JULIA_MODULE.menuGroup,
          is_menu_visible: true,
          display_order: X_JULIA_MODULE.displayOrder,
          is_active: true,
          category: X_JULIA_MODULE.category as any,
        });
        queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
        queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
      } catch (error) {
        console.error('Erro ao configurar módulo X-Julia:', error);
      }
    })();
  }, [isAdmin, queryClient]);
}