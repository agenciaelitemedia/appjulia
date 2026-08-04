/**
 * Auto-registro do módulo Automações na matriz de módulos/permissões.
 * Mesmo padrão dos demais `useEnsure*Module`.
 */
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { externalDb } from './db';
import { FLOW_BUILDER_MODULE } from '../module';

export function useEnsureFlowBuilderModule() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAdmin) return;

    const ensureModule = async () => {
      try {
        const modules = await externalDb.getModules();
        const existing = modules.find((m: any) => m.code === FLOW_BUILDER_MODULE.code);

        if (existing) {
          if (
            existing.route !== FLOW_BUILDER_MODULE.route ||
            !existing.is_menu_visible ||
            existing.menu_group !== FLOW_BUILDER_MODULE.menuGroup
          ) {
            await externalDb.updateModule(existing.id, {
              route: FLOW_BUILDER_MODULE.route,
              is_menu_visible: true,
              menu_group: FLOW_BUILDER_MODULE.menuGroup,
            });
            queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
          }
          return;
        }

        await externalDb.createModule({
          name: FLOW_BUILDER_MODULE.name,
          code: FLOW_BUILDER_MODULE.code as any,
          description: FLOW_BUILDER_MODULE.description,
          icon: FLOW_BUILDER_MODULE.icon,
          route: FLOW_BUILDER_MODULE.route,
          menu_group: FLOW_BUILDER_MODULE.menuGroup,
          is_menu_visible: true,
          display_order: FLOW_BUILDER_MODULE.displayOrder,
          is_active: true,
          category: 'sistema',
        });

        queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
        queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
      } catch (error) {
        console.error('Erro ao configurar módulo Automações:', error);
      }
    };

    ensureModule();
  }, [isAdmin, queryClient]);
}