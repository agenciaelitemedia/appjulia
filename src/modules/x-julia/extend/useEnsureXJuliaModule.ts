/**
 * Auto-registro dos itens do menu "AGENTE X-JULIA" na matriz de módulos/permissões.
 */
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { externalDb } from './db';
import { X_JULIA_MENU_GROUP, X_JULIA_MENU_ITEMS } from '../module';

export function useEnsureXJuliaModule() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAdmin) return;

    (async () => {
      let changed = false;
      try {
        const modules = await externalDb.getModules();

        for (const item of X_JULIA_MENU_ITEMS) {
          const existing = modules.find((m: any) => m.code === item.code || m.route === item.route);

          if (existing) {
            const needsUpdate =
              existing.name !== item.name ||
              existing.route !== item.route ||
              existing.icon !== item.icon ||
              existing.menu_group !== X_JULIA_MENU_GROUP ||
              !existing.is_menu_visible ||
              existing.display_order !== item.displayOrder;

            if (needsUpdate) {
              await externalDb.updateModule(existing.id, {
                name: item.name,
                route: item.route,
                icon: item.icon,
                menu_group: X_JULIA_MENU_GROUP,
                is_menu_visible: true,
                display_order: item.displayOrder,
              });
              changed = true;
            }
            continue;
          }

          await externalDb.createModule({
            code: item.code as any,
            name: item.name,
            description: item.description,
            icon: item.icon,
            route: item.route,
            menu_group: X_JULIA_MENU_GROUP,
            is_menu_visible: true,
            display_order: item.displayOrder,
            is_active: true,
            category: 'agente' as any,
          });
          changed = true;
        }
      } catch (error) {
        console.error('Erro ao configurar módulos X-Julia:', error);
      }

      if (changed) {
        queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
        queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
      }
    })();
  }, [isAdmin, queryClient]);
}