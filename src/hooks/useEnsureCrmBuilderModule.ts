import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { externalDb } from '@/lib/externalDb';

export function useEnsureCrmBuilderModule() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAdmin) return;

    const ensure = async () => {
      try {
        const modules = await externalDb.getModules();
        const existing = modules.find((m: any) => m.code === 'crm_builder');

        if (existing) {
          if (
            existing.route !== '/crm-builder' ||
            !existing.is_menu_visible ||
            existing.menu_group !== 'CRM'
          ) {
            await externalDb.updateModule(existing.id, {
              route: '/crm-builder',
              is_menu_visible: true,
              menu_group: 'CRM',
            });
            queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
          }
          return;
        }

        await externalDb.createModule({
          name: 'Construtor de CRM',
          code: 'crm_builder' as any,
          description: 'Quadros, pipelines e cards customizados',
          icon: 'LayoutDashboard',
          route: '/crm-builder',
          menu_group: 'CRM',
          is_menu_visible: true,
          display_order: 25,
          is_active: true,
          category: 'crm',
        });

        queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
        queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
      } catch (error) {
        console.error('Erro ao configurar módulo Construtor de CRM:', error);
      }
    };

    ensure();
  }, [isAdmin, queryClient]);
}