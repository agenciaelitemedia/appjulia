import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { externalDb } from '@/lib/externalDb';

/**
 * Hook para garantir que o módulo Monitoramento existe e está no menu
 */
export function useEnsureMonitoramentoModule() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAdmin) return;

    const ensureModule = async () => {
      try {
        const modules = await externalDb.getModules();
        const monitoramentoModule = modules.find((m: any) => m.code === 'monitoring');

        if (monitoramentoModule) {
          if (monitoramentoModule.route !== '/admin/monitoramento' || !monitoramentoModule.is_menu_visible) {
            await externalDb.updateModule(monitoramentoModule.id, {
              route: '/admin/monitoramento',
              is_menu_visible: true,
              menu_group: 'ADMINISTRATIVO',
            });
            queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
          }
          return;
        }

        await externalDb.createModule({
          name: 'Monitoramento',
          code: 'monitoring' as any,
          description: 'Gerenciar vínculos de agentes monitorados por usuário',
          icon: 'Eye',
          route: '/admin/monitoramento',
          menu_group: 'ADMINISTRATIVO',
          is_menu_visible: true,
          display_order: 55,
          is_active: true,
          category: 'admin',
        });

        queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
        queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
      } catch (error) {
        console.error('Erro ao configurar módulo Monitoramento:', error);
      }
    };

    ensureModule();
  }, [isAdmin, queryClient]);
}
