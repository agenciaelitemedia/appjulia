import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { externalDb } from '@/lib/externalDb';
import { isCopilotEnabled } from '@/lib/environment';

export function useEnsureCopilotModule() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAdmin || !isCopilotEnabled()) return;

    const ensureModule = async () => {
      try {
        const modules = await externalDb.getModules();
        const copilotModule = modules.find((m: any) => m.code === 'copilot_admin');

        if (copilotModule) {
          if (copilotModule.route !== '/admin/copiloto' || !copilotModule.is_menu_visible) {
            await externalDb.updateModule(copilotModule.id, {
              route: '/admin/copiloto',
              is_menu_visible: true,
              menu_group: 'ADMINISTRATIVO',
            });
            queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
          }
          return;
        }

        await externalDb.createModule({
          name: 'Copiloto IA',
          code: 'copilot_admin' as any,
          description: 'Configurações e monitoramento do Copiloto Julia IA',
          icon: 'Sparkles',
          route: '/admin/copiloto',
          menu_group: 'ADMINISTRATIVO',
          is_menu_visible: true,
          display_order: 56,
          is_active: true,
          category: 'admin',
        });

        queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
        queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
      } catch (error) {
        console.error('Erro ao configurar módulo Copiloto:', error);
      }
    };

    ensureModule();
  }, [isAdmin, queryClient]);
}
