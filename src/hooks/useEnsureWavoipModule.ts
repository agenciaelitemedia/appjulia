import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { externalDb } from '@/lib/externalDb';

export function useEnsureWavoipModule() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAdmin) return;

    const ensureModules = async () => {
      try {
        const modules = await externalDb.getModules();

        // Admin module
        const adminMod = modules.find((m: any) => m.code === 'wavoip_admin');
        if (!adminMod) {
          await externalDb.createModule({
            name: 'Wavoip (Admin)',
            code: 'wavoip_admin' as any,
            description: 'Gestão de planos, ativações, dispositivos e histórico de chamadas Wavoip',
            icon: 'PhoneCall',
            route: '/admin/wavoip',
            menu_group: 'ADMINISTRATIVO',
            is_menu_visible: true,
            display_order: 58,
            is_active: true,
            category: 'admin',
          });
          queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
          queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
        }

        // User module
        const userMod = modules.find((m: any) => m.code === 'wavoip');
        if (!userMod) {
          await externalDb.createModule({
            name: 'Wavoip',
            code: 'wavoip' as any,
            description: 'Chamadas de voz WhatsApp via Wavoip',
            icon: 'PhoneCall',
            route: '/wavoip',
            menu_group: 'SISTEMA',
            is_menu_visible: true,
            display_order: 36,
            is_active: true,
            category: 'sistema',
          });
          queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
          queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
        }
      } catch (error) {
        console.error('Erro ao configurar módulos Wavoip:', error);
      }
    };

    ensureModules();
  }, [isAdmin, queryClient]);
}