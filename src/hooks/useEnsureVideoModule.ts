import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { externalDb } from '@/lib/externalDb';

export function useEnsureVideoModule() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAdmin) return;

    const ensure = async () => {
      try {
        const modules = await externalDb.getModules();

        // Admin module
        const adminMod = modules.find((m: any) => m.code === 'video_admin');
        if (adminMod) {
          if (adminMod.route !== '/admin/video' || !adminMod.is_menu_visible) {
            await externalDb.updateModule(adminMod.id, {
              route: '/admin/video',
              is_menu_visible: true,
              menu_group: 'ADMINISTRATIVO',
            });
            queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
          }
        } else {
          await externalDb.createModule({
            name: 'Videochamadas (Admin)',
            code: 'video_admin' as any,
            description: 'Gestão de planos e pedidos de videochamadas',
            icon: 'Video',
            route: '/admin/video',
            menu_group: 'ADMINISTRATIVO',
            is_menu_visible: true,
            display_order: 58,
            is_active: true,
            category: 'admin',
          });
          queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
          queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
        }

        // User module — contratação
        const userMod = modules.find((m: any) => m.code === 'video_contratar');
        if (userMod) {
          if (userMod.route !== '/video/contratar' || !userMod.is_menu_visible) {
            await externalDb.updateModule(userMod.id, {
              route: '/video/contratar',
              is_menu_visible: true,
              menu_group: 'SISTEMA',
            });
            queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
          }
        } else {
          await externalDb.createModule({
            name: 'Videochamadas',
            code: 'video_contratar' as any,
            description: 'Contratação de planos de videochamadas',
            icon: 'Video',
            route: '/video/contratar',
            menu_group: 'SISTEMA',
            is_menu_visible: true,
            display_order: 36,
            is_active: true,
            category: 'sistema',
          });
          queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
          queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
        }
      } catch (error) {
        console.error('Erro ao configurar módulos Videochamadas:', error);
      }
    };

    ensure();
  }, [isAdmin, queryClient]);
}