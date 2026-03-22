import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { externalDb } from '@/lib/externalDb';

export function useEnsureTelefoniaModule() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAdmin) return;

    const ensureModules = async () => {
      try {
        const modules = await externalDb.getModules();

        // Admin module
        const adminMod = modules.find((m: any) => m.code === 'telephony_admin');
        if (adminMod) {
          if (adminMod.route !== '/admin/telefonia' || !adminMod.is_menu_visible) {
            await externalDb.updateModule(adminMod.id, {
              route: '/admin/telefonia',
              is_menu_visible: true,
              menu_group: 'ADMINISTRATIVO',
            });
            queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
          }
        } else {
          await externalDb.createModule({
            name: 'Telefonia (Admin)',
            code: 'telephony_admin' as any,
            description: 'Gestão de planos de ramais, configuração Api4Com e histórico de chamadas',
            icon: 'Phone',
            route: '/admin/telefonia',
            menu_group: 'ADMINISTRATIVO',
            is_menu_visible: true,
            display_order: 57,
            is_active: true,
            category: 'admin',
          });
          queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
          queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
        }

        // User module
        const userMod = modules.find((m: any) => m.code === 'telephony');
        if (userMod) {
          if (userMod.route !== '/telefonia' || !userMod.is_menu_visible) {
            await externalDb.updateModule(userMod.id, {
              route: '/telefonia',
              is_menu_visible: true,
              menu_group: 'SISTEMA',
            });
            queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
          }
        } else {
          await externalDb.createModule({
            name: 'Telefonia',
            code: 'telephony' as any,
            description: 'Discador, ramais e histórico de chamadas',
            icon: 'Phone',
            route: '/telefonia',
            menu_group: 'SISTEMA',
            is_menu_visible: true,
            display_order: 35,
            is_active: true,
            category: 'sistema',
          });
          queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
          queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
        }
      } catch (error) {
        console.error('Erro ao configurar módulos Telefonia:', error);
      }
    };

    ensureModules();
  }, [isAdmin, queryClient]);
}
