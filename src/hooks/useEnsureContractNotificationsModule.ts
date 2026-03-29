import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { externalDb } from '@/lib/externalDb';

export function useEnsureContractNotificationsModule() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAdmin) return;

    const ensureModule = async () => {
      try {
        const modules = await externalDb.getModules();
        const mod = modules.find((m: any) => m.code === 'contract_notifications');

        if (mod) {
          if (mod.route !== '/notificacoes-contrato' || !mod.is_menu_visible) {
            await externalDb.updateModule(mod.id, {
              route: '/notificacoes-contrato',
              is_menu_visible: true,
              menu_group: 'SISTEMA',
            });
            queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
          }
          return;
        }

        await externalDb.createModule({
          name: 'Notificações de Contrato',
          code: 'contract_notifications' as any,
          description: 'Followup automático e alertas de contratos',
          icon: 'Bell',
          route: '/notificacoes-contrato',
          menu_group: 'AGENTES DA JULIA',
          is_menu_visible: true,
          display_order: 31,
          is_active: true,
          category: 'agente',
        });

        queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
        queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
      } catch (error) {
        console.error('Erro ao configurar módulo Notificações de Contrato:', error);
      }
    };

    ensureModule();
  }, [isAdmin, queryClient]);
}
