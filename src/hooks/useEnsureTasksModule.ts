import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { externalDb } from '@/lib/externalDb';

export function useEnsureTasksModule() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAdmin) return;

    const ensureModule = async () => {
      try {
        const modules = await externalDb.getModules();
        const existing = modules.find((m: any) => m.code === 'tasks');

        if (existing) {
          if (
            existing.route !== '/tarefas' ||
            !existing.is_menu_visible ||
            existing.menu_group !== 'SISTEMA'
          ) {
            await externalDb.updateModule(existing.id, {
              route: '/tarefas',
              is_menu_visible: true,
              menu_group: 'SISTEMA',
            });
            queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
          }
          return;
        }

        await externalDb.createModule({
          name: 'Tarefas',
          code: 'tasks' as any,
          description: 'Sistema de tarefas rankeadas com pontuação',
          icon: 'CheckSquare',
          route: '/tarefas',
          menu_group: 'SISTEMA',
          is_menu_visible: true,
          display_order: 80,
          is_active: true,
          category: 'admin',
        });

        queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
        queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
      } catch (error) {
        console.error('Erro ao configurar módulo Tarefas:', error);
      }
    };

    ensureModule();
  }, [isAdmin, queryClient]);
}