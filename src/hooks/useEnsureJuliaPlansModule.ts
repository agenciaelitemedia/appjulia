import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { externalDb } from '@/lib/externalDb';

export function useEnsureJuliaPlansModule() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAdmin) return;

    const ensureModule = async () => {
      try {
        const modules = await externalDb.getModules();
        const existing = modules.find((m: any) => m.code === 'julia_plans');

        if (existing) {
          if (existing.route !== '/admin/planos' || !existing.is_menu_visible || existing.menu_group !== 'ADMINISTRATIVO') {
            await externalDb.updateModule(existing.id, {
              route: '/admin/planos',
              is_menu_visible: true,
              menu_group: 'ADMINISTRATIVO',
            });
            queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
          }
          return;
        }

        await externalDb.createModule({
          name: 'Planos da Julia',
          code: 'julia_plans' as any,
          description: 'Gestão de planos de assinatura da Julia',
          icon: 'CreditCard',
          route: '/admin/planos',
          menu_group: 'ADMINISTRATIVO',
          is_menu_visible: true,
          display_order: 64,
          is_active: true,
          category: 'admin',
        });

        queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
        queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
      } catch (error) {
        console.error('Erro ao configurar módulo Planos da Julia:', error);
      }
    };

    ensureModule();
  }, [isAdmin, queryClient]);
}
