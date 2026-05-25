import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { externalDb } from '@/lib/externalDb';

export function useEnsureTicketsModule() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAdmin) return;

    const ensureModule = async () => {
      try {
        const modules = await externalDb.getModules();
        const existing = modules.find((m: any) => m.code === 'support_tickets');

        if (existing) {
          if (
            existing.route !== '/tickets' ||
            !existing.is_menu_visible ||
            existing.menu_group !== 'SISTEMA'
          ) {
            await externalDb.updateModule(existing.id, {
              route: '/tickets',
              is_menu_visible: true,
              menu_group: 'SISTEMA',
            });
            queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
          }
          return;
        }

        await externalDb.createModule({
          name: 'Suporte / Chamados',
          code: 'support_tickets' as any,
          description: 'Tickets de suporte: abertura, atendimento, SLA e relatórios',
          icon: 'LifeBuoy',
          route: '/tickets',
          menu_group: 'SISTEMA',
          is_menu_visible: true,
          display_order: 88,
          is_active: true,
          category: 'admin',
        });

        queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
        queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
      } catch (error) {
        console.error('Erro ao configurar módulo Suporte/Chamados:', error);
      }
    };

    ensureModule();
  }, [isAdmin, queryClient]);
}
