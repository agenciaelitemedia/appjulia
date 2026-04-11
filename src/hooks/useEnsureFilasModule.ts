import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import { useAuth } from '@/contexts/AuthContext';

export function useEnsureFilasModule() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();

  useEffect(() => {
    if (!isAdmin) return;

    const ensure = async () => {
      try {
        const modules = await externalDb.getMenuModules();
        const mod = modules.find((m: any) => m.route === '/agente/filas');

        if (mod) {
          if (!mod.is_menu_visible || mod.menu_group !== 'AGENTES DA JULIA') {
            await externalDb.updateModule(mod.id, {
              route: '/agente/filas',
              is_menu_visible: true,
              menu_group: 'AGENTES DA JULIA',
            });
            queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
          }
          return;
        }

        await externalDb.createModule({
          name: 'Filas de Atendimento',
          icon: 'Network',
          route: '/agente/filas',
          menu_group: 'AGENTES DA JULIA',
          is_menu_visible: true,
          display_order: 15,
        });

        queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
        queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
      } catch (error) {
        console.error('[useEnsureFilasModule] Error:', error);
      }
    };

    ensure();
  }, [isAdmin, queryClient]);
}
