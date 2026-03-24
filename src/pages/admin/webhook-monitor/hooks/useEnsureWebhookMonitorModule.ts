import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { externalDb } from '@/lib/externalDb';

export function useEnsureWebhookMonitorModule() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAdmin) return;

    const ensureModule = async () => {
      try {
        const modules = await externalDb.getModules();
        const existing = modules.find((m: any) => m.code === 'webhook_monitor');

        if (existing) {
          if (existing.route !== '/admin/webhook-monitor' || !existing.is_menu_visible) {
            await externalDb.updateModule(existing.id, {
              route: '/admin/webhook-monitor',
              is_menu_visible: true,
              menu_group: 'ADMINISTRATIVO',
            });
            queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
          }
          return;
        }

        await externalDb.createModule({
          name: 'Webhook Monitor',
          code: 'webhook_monitor' as any,
          description: 'Monitoramento em tempo real dos webhooks WABA',
          icon: 'Radio',
          route: '/admin/webhook-monitor',
          menu_group: 'ADMINISTRATIVO',
          is_menu_visible: true,
          display_order: 58,
          is_active: true,
          category: 'admin',
        });

        queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
        queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
      } catch (error) {
        console.error('Erro ao configurar módulo Webhook Monitor:', error);
      }
    };

    ensureModule();
  }, [isAdmin, queryClient]);
}
