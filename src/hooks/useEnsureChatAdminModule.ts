import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { externalDb } from '@/lib/externalDb';

export function useEnsureChatAdminModule() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAdmin) return;

    (async () => {
      try {
        const modules = await externalDb.getModules();
        const mod = modules.find((m: any) => m.code === 'chat_admin');
        if (mod) {
          if (mod.route !== '/admin/chat' || !mod.is_menu_visible || mod.menu_group !== 'ADMINISTRATIVO') {
            await externalDb.updateModule(mod.id, {
              route: '/admin/chat',
              is_menu_visible: true,
              menu_group: 'ADMINISTRATIVO',
            });
            queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
          }
        } else {
          await externalDb.createModule({
            name: 'Chat (Admin)',
            code: 'chat_admin' as any,
            description: 'Provedores de fila, configurações de chat por cliente, histórico e monitor UaZapi',
            icon: 'MessageSquare',
            route: '/admin/chat',
            menu_group: 'ADMINISTRATIVO',
            is_menu_visible: true,
            display_order: 58,
            is_active: true,
            category: 'admin',
          });
          queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
          queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
        }
      } catch (error) {
        console.error('Erro ao configurar módulo Chat (Admin):', error);
      }
    })();
  }, [isAdmin, queryClient]);
}