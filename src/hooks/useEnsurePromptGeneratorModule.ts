import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { externalDb } from '@/lib/externalDb';

export function useEnsurePromptGeneratorModule() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAdmin) return;

    const ensureModule = async () => {
      try {
        const modules = await externalDb.getModules();
        const mod = modules.find((m: any) => m.code === 'prompt_generator');

        if (mod) {
          if (mod.route !== '/admin/prompts' || !mod.is_menu_visible) {
            await externalDb.updateModule(mod.id, {
              route: '/admin/prompts',
              is_menu_visible: true,
              menu_group: 'ADMINISTRATIVO',
            });
            queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
          }
          return;
        }

        await externalDb.createModule({
          name: 'Prompts Implantação',
          code: 'prompt_generator' as any,
          description: 'Gestão de prompts de implantação e qualificação jurídica com IA',
          icon: 'FileText',
          route: '/admin/prompts',
          menu_group: 'ADMINISTRATIVO',
          is_menu_visible: true,
          display_order: 57,
          is_active: true,
          category: 'admin',
        });

        queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
        queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
      } catch (error) {
        console.error('Erro ao configurar módulo Gerador de Prompt:', error);
      }
    };

    ensureModule();
  }, [isAdmin, queryClient]);
}
