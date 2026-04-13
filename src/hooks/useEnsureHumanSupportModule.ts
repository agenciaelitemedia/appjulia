import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { externalDb } from '@/lib/externalDb';

export function useEnsureHumanSupportModule() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAdmin) return;

    const ensure = async () => {
      try {
        const modules = await externalDb.getModules();
        const existing = modules.find((m: any) => m.code === 'human_support');

        if (existing) {
          if (existing.route !== '/atendimento-humano' || !existing.is_menu_visible || existing.menu_group !== 'SISTEMA') {
            await externalDb.updateModule(existing.id, {
              route: '/atendimento-humano',
              is_menu_visible: true,
              menu_group: 'SISTEMA',
            });
            queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
          }
          return;
        }

        await externalDb.createModule({
          name: 'Atendimento Humano',
          code: 'human_support' as any,
          description: 'Atendimento manual de leads com IA inativa',
          icon: 'Headset',
          route: '/atendimento-humano',
          menu_group: 'SISTEMA',
          is_menu_visible: true,
          display_order: 55,
          is_active: true,
          category: 'sistema',
        });

        queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
        queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
      } catch (error) {
        console.error('Erro ao configurar módulo Atendimento Humano:', error);
      }
    };

    ensure();
  }, [isAdmin, queryClient]);
}
