import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { externalDb } from '@/lib/externalDb';

export function useEnsureLegalCasesModule() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAdmin) return;

    const ensureModule = async () => {
      try {
        const modules = await externalDb.getModules();
        const mod = modules.find((m: any) => m.code === 'legal_cases');

        if (mod) {
          if (mod.route !== '/casos-juridicos' || !mod.is_menu_visible) {
            await externalDb.updateModule(mod.id, {
              route: '/casos-juridicos',
              is_menu_visible: true,
              menu_group: 'SISTEMA',
            });
            queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
          }
          return;
        }

        await externalDb.createModule({
          name: 'Casos Jurídicos',
          code: 'legal_cases' as any,
          description: 'Biblioteca de casos jurídicos com roteiros de qualificação',
          icon: 'Scale',
          route: '/casos-juridicos',
          menu_group: 'SISTEMA',
          is_menu_visible: true,
          display_order: 30,
          is_active: true,
          category: 'sistema',
        });

        queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
        queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
      } catch (error) {
        console.error('Erro ao configurar módulo Casos Jurídicos:', error);
      }
    };

    ensureModule();
  }, [isAdmin, queryClient]);
}
