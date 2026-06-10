import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { externalDb } from '@/lib/externalDb';

export function useEnsureHelpCenterModule() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAdmin) return;

    const ensureModule = async () => {
      try {
        const modules = await externalDb.getModules();
        const existing = modules.find((m: any) => m.code === 'help_center');

        if (existing) {
          if (
            existing.route !== '/ajuda' ||
            !existing.is_menu_visible ||
            existing.menu_group !== 'SISTEMA'
          ) {
            await externalDb.updateModule(existing.id, {
              route: '/ajuda',
              is_menu_visible: true,
              menu_group: 'SISTEMA',
            });
            queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
          }
          return;
        }

        await externalDb.createModule({
          name: 'Central de Ajuda',
          code: 'help_center' as any,
          description: 'Central de conteúdos de ajuda: categorias, posts, imagens e vídeos',
          icon: 'BookOpen',
          route: '/ajuda',
          menu_group: 'SISTEMA',
          is_menu_visible: true,
          display_order: 89,
          is_active: true,
          category: 'sistema',
        });

        queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
        queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
      } catch (error) {
        console.error('Erro ao configurar módulo Central de Ajuda:', error);
      }
    };

    ensureModule();
  }, [isAdmin, queryClient]);
}