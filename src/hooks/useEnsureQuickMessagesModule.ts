import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { externalDb } from '@/lib/externalDb';

export function useEnsureQuickMessagesModule() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAdmin) return;

    const ensureModule = async () => {
      try {
        const modules = await externalDb.getModules();
        const existing = modules.find((m: any) => m.code === 'quick_messages');

        if (existing) {
          if (existing.route !== '/mensagens-rapidas' || !existing.is_menu_visible || existing.menu_group !== 'SISTEMA') {
            await externalDb.updateModule(existing.id, {
              route: '/mensagens-rapidas',
              is_menu_visible: true,
              menu_group: 'SISTEMA',
            });
            queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
          }
          return;
        }

        await externalDb.createModule({
          name: 'Mensagens Rápidas',
          code: 'quick_messages' as any,
          description: 'Gerenciamento de mensagens rápidas pré-definidas',
          icon: 'Zap',
          route: '/mensagens-rapidas',
          menu_group: 'SISTEMA',
          is_menu_visible: true,
          display_order: 70,
          is_active: true,
          category: 'admin',
        });

        queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
        queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
      } catch (error) {
        console.error('Erro ao configurar módulo Mensagens Rápidas:', error);
      }
    };

    ensureModule();
  }, [isAdmin, queryClient]);
}
