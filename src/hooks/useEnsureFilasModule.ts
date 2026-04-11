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

        // Ensure Filas module
        const filasMod = modules.find((m: any) => m.route === '/agente/filas');
        if (filasMod) {
          if (!filasMod.is_menu_visible || filasMod.menu_group !== 'CONFIGURAÇÕES' || filasMod.name !== 'Filas') {
            await externalDb.updateModule(filasMod.id, {
              name: 'Filas',
              route: '/agente/filas',
              is_menu_visible: true,
              menu_group: 'CONFIGURAÇÕES',
            });
            queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
          }
        } else {
          await externalDb.createModule({
            code: 'filas',
            name: 'Filas',
            category: 'sistema',
            icon: 'Network',
            route: '/agente/filas',
            menu_group: 'CONFIGURAÇÕES',
            is_menu_visible: true,
            display_order: 15,
          });
          queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
          queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
        }

        // Ensure Configurações module
        const configMod = modules.find((m: any) => m.route === '/configuracoes');
        if (configMod) {
          if (!configMod.is_menu_visible || configMod.menu_group !== 'CONFIGURAÇÕES' || configMod.name !== 'Configurações') {
            await externalDb.updateModule(configMod.id, {
              name: 'Configurações',
              route: '/configuracoes',
              is_menu_visible: true,
              menu_group: 'CONFIGURAÇÕES',
            });
            queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
          }
        } else {
          await externalDb.createModule({
            code: 'configuracoes',
            name: 'Configurações',
            category: 'sistema',
            icon: 'Settings',
            route: '/configuracoes',
            menu_group: 'CONFIGURAÇÕES',
            is_menu_visible: true,
            display_order: 14,
          });
          queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
          queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
        }
      } catch (error) {
        console.error('[useEnsureFilasModule] Error:', error);
      }
    };

    ensure();
  }, [isAdmin, queryClient]);
}
