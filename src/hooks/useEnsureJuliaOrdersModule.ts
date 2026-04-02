import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { externalDb } from '@/lib/externalDb';

export function useEnsureJuliaOrdersModule() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAdmin) return;

    const ensureModule = async () => {
      try {
        const modules = await externalDb.getModules();
        const existing = modules.find((m: any) => m.code === 'julia_orders');

        if (existing) {
          if (existing.route !== '/admin/pedidos' || !existing.is_menu_visible || existing.menu_group !== 'ADMINISTRATIVO') {
            await externalDb.updateModule(existing.id, {
              route: '/admin/pedidos',
              is_menu_visible: true,
              menu_group: 'ADMINISTRATIVO',
            });
            queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
          }
          return;
        }

        await externalDb.createModule({
          name: 'Pedidos da Julia',
          code: 'julia_orders' as any,
          description: 'Gestão de pedidos e vendas da Julia',
          icon: 'ShoppingCart',
          route: '/admin/pedidos',
          menu_group: 'ADMINISTRATIVO',
          is_menu_visible: true,
          display_order: 62,
          is_active: true,
          category: 'admin',
        });

        queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
        queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
      } catch (error) {
        console.error('Erro ao configurar módulo Pedidos da Julia:', error);
      }
    };

    ensureModule();
  }, [isAdmin, queryClient]);
}
