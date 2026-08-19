/**
 * Auto-registro do módulo Notificações e Alertas na matriz de módulos/permissões.
 */
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './auth';
import { externalDb } from './db';
import { ALERTS_MODULE } from '../module';

export function useEnsureAlertsModule() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAdmin) return;

    const ensure = async () => {
      try {
        const modules = await externalDb.getModules();
        const existing = modules.find((m: any) => m.code === ALERTS_MODULE.code);

        if (existing) {
          if (
            existing.route !== ALERTS_MODULE.route ||
            !existing.is_menu_visible ||
            existing.menu_group !== ALERTS_MODULE.menuGroup ||
            existing.name !== ALERTS_MODULE.name
          ) {
            await externalDb.updateModule(existing.id, {
              name: ALERTS_MODULE.name,
              route: ALERTS_MODULE.route,
              is_menu_visible: true,
              menu_group: ALERTS_MODULE.menuGroup,
            });
            queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
            queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
          }
          return;
        }

        await externalDb.createModule({
          name: ALERTS_MODULE.name,
          code: ALERTS_MODULE.code as any,
          description: ALERTS_MODULE.description,
          icon: ALERTS_MODULE.icon,
          route: ALERTS_MODULE.route,
          menu_group: ALERTS_MODULE.menuGroup,
          is_menu_visible: true,
          display_order: ALERTS_MODULE.displayOrder,
          is_active: true,
          category: ALERTS_MODULE.category as any,
        });

        queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
        queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
      } catch (error) {
        console.error('Erro ao configurar módulo Notificações e Alertas:', error);
      }
    };

    ensure();
  }, [isAdmin, queryClient]);
}
