import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { externalDb } from '@/lib/externalDb';

export function useEnsureSupportAssistantModule() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAdmin) return;

    const ensure = async () => {
      try {
        const modules = await externalDb.getModules();
        const existing = modules.find((m: any) => m.code === 'support_assistant');

        if (existing) {
          if (existing.route !== '/suporte-assistente' || !existing.is_menu_visible || existing.menu_group !== 'SISTEMA') {
            await externalDb.updateModule(existing.id, {
              route: '/suporte-assistente',
              is_menu_visible: true,
              menu_group: 'SISTEMA',
            });
            queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
          }
          return;
        }

        await externalDb.createModule({
          name: 'Assistente de Suporte',
          code: 'support_assistant' as any,
          description: 'Assistente de suporte com análise de conversas de grupos WhatsApp',
          icon: 'Headset',
          route: '/suporte-assistente',
          menu_group: 'SISTEMA',
          is_menu_visible: true,
          display_order: 80,
          is_active: true,
          category: 'sistema',
        });

        queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
        queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
      } catch (error) {
        console.error('Erro ao configurar módulo Assistente de Suporte:', error);
      }
    };

    ensure();
  }, [isAdmin, queryClient]);
}
