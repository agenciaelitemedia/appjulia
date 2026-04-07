import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { externalDb } from '@/lib/externalDb';

export function useEnsureCrmComercialModule() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAdmin) return;

    const ensure = async () => {
      try {
        const modules = await externalDb.getModules();
        const existing = modules.find((m: any) => m.code === 'crm_comercial');

        if (existing) {
          if (existing.route !== '/comercial/crm' || !existing.is_menu_visible || existing.menu_group !== 'COMERCIAL') {
            await externalDb.updateModule(existing.id, {
              route: '/comercial/crm',
              is_menu_visible: true,
              menu_group: 'COMERCIAL',
            });
            queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
          }
          return;
        }

        await externalDb.createModule({
          name: 'CRM Comercial',
          code: 'crm_comercial' as any,
          description: 'Pipeline de vendas e oportunidades comerciais',
          icon: 'Briefcase',
          route: '/comercial/crm',
          menu_group: 'COMERCIAL',
          is_menu_visible: true,
          display_order: 70,
          is_active: true,
          category: 'crm',
        });

        queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
        queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
      } catch (error) {
        console.error('Erro ao configurar módulo CRM Comercial:', error);
      }
    };

    ensure();
  }, [isAdmin, queryClient]);
}
