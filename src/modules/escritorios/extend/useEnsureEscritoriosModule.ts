/**
 * Auto-registro dos módulos Escritórios e Painel de Atendimento
 * na matriz de módulos/permissões (mesmo padrão dos demais useEnsure*Module).
 */
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { externalDb } from './db';
import { ESCRITORIOS_MODULE, OFFICE_DASHBOARD_MODULE } from '../module';

const TARGETS = [ESCRITORIOS_MODULE, OFFICE_DASHBOARD_MODULE];

export function useEnsureEscritoriosModule() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAdmin) return;

    const ensure = async () => {
      try {
        const modules = await externalDb.getModules();
        let changed = false;

        for (const target of TARGETS) {
          const existing = modules.find((m: any) => m.code === target.code);
          if (existing) {
            if (
              existing.route !== target.route ||
              !existing.is_menu_visible ||
              existing.menu_group !== target.menuGroup
            ) {
              await externalDb.updateModule(existing.id, {
                route: target.route,
                is_menu_visible: true,
                menu_group: target.menuGroup,
              });
              changed = true;
            }
            continue;
          }

          await externalDb.createModule({
            name: target.name,
            code: target.code as any,
            description: target.description,
            icon: target.icon,
            route: target.route,
            menu_group: target.menuGroup,
            is_menu_visible: true,
            display_order: target.displayOrder,
            is_active: true,
            category: target.category as any,
          });
          changed = true;
        }

        if (changed) {
          queryClient.invalidateQueries({ queryKey: ['menu-modules'] });
          queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
        }
      } catch (error) {
        console.error('Erro ao configurar módulo Escritórios:', error);
      }
    };

    ensure();
  }, [isAdmin, queryClient]);
}