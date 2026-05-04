import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { externalDb } from '@/lib/externalDb';

export function useEnsureOperacoesModule() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAdmin) return;

    const ensureModule = async () => {
      try {
        const modules = await externalDb.getModules();
        const existing = modules.find((m: any) => m.code === 'admin_operacoes');

        if (existing) {
          if (
            existing.route !== '/admin/operacoes' ||
            !existing.is_menu_visible ||
            existing.menu_group !== 'ADMINISTRATIVO'
          ) {
            await externalDb.updateModule(existing.id, {
              route: '/admin/operacoes',
              is_menu_visible: true,
              menu_group: 'ADMINISTRATIVO',
            });
            queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
          }
          return;
        }

        await externalDb.createModule({
          name: 'Operações',
          code: 'admin_operacoes' as any,
          description: 'Monitor de operações e infraestrutura',
          icon: 'Activity',
          route: '/admin/operacoes',
          menu_group: 'ADMINISTRATIVO',
          is_menu_visible: true,
          display_order: 60,
          is_active: true,
          category: 'admin',
        });

        queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
        queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
      } catch (error) {
        console.error('Erro ao configurar módulo Operações:', error);
      }
    };

    ensureModule();
  }, [isAdmin, queryClient]);
}
