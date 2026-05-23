import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { externalDb } from '@/lib/externalDb';

export function useEnsureNotifyModule() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAdmin) return;

    const ensureModule = async () => {
      try {
        const modules = await externalDb.getModules();
        const existing = modules.find((m: any) => m.code === 'notify_customers');

        if (existing) {
          const desiredName = 'Notificação Interna';
          if (
            existing.route !== '/notificar-clientes' ||
            !existing.is_menu_visible ||
            existing.menu_group !== 'SISTEMA' ||
            existing.name !== desiredName
          ) {
            await externalDb.updateModule(existing.id, {
              name: desiredName,
              route: '/notificar-clientes',
              is_menu_visible: true,
              menu_group: 'SISTEMA',
            });
            queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
          }
          return;
        }

        await externalDb.createModule({
          name: 'Notificação Interna',
          code: 'notify_customers' as any,
          description: 'Notificações internas em tempo real (mensagem, enquete, pergunta)',
          icon: 'Bell',
          route: '/notificar-clientes',
          menu_group: 'SISTEMA',
          is_menu_visible: true,
          display_order: 86,
          is_active: true,
          category: 'admin',
        });

        queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
        queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
      } catch (error) {
        console.error('Erro ao configurar módulo Notificar Clientes:', error);
      }
    };

    ensureModule();
  }, [isAdmin, queryClient]);
}
