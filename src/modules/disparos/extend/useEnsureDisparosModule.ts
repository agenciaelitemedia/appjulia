/**
 * Auto-registro do módulo de Disparos na matriz de módulos/permissões.
 */
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './auth';
import { externalDb } from './db';
import { DISPAROS_MODULE } from '../module';

export function useEnsureDisparosModule() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAdmin) return;

    (async () => {
      try {
        const modules = await externalDb.getModules();
        const existing = modules.find((m: any) => m.code === DISPAROS_MODULE.code);

        if (existing) {
          const needsUpdate =
            existing.route !== DISPAROS_MODULE.route ||
            existing.name !== DISPAROS_MODULE.name ||
            existing.icon !== DISPAROS_MODULE.icon ||
            existing.menu_group !== DISPAROS_MODULE.menuGroup ||
            !existing.is_menu_visible;

          if (needsUpdate) {
            await externalDb.updateModule(existing.id, {
              name: DISPAROS_MODULE.name,
              route: DISPAROS_MODULE.route,
              icon: DISPAROS_MODULE.icon,
              menu_group: DISPAROS_MODULE.menuGroup,
              is_menu_visible: true,
              display_order: DISPAROS_MODULE.displayOrder,
            });
            queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
            queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
          }
          return;
        }

        await externalDb.createModule({
          code: DISPAROS_MODULE.code as any,
          name: DISPAROS_MODULE.name,
          description: DISPAROS_MODULE.description,
          icon: DISPAROS_MODULE.icon,
          route: DISPAROS_MODULE.route,
          menu_group: DISPAROS_MODULE.menuGroup,
          is_menu_visible: true,
          display_order: DISPAROS_MODULE.displayOrder,
          is_active: true,
          category: DISPAROS_MODULE.category as any,
        });

        queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
        queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
      } catch (error) {
        console.error('Erro ao configurar módulo Disparos:', error);
      }
    })();
  }, [isAdmin, queryClient]);
}
