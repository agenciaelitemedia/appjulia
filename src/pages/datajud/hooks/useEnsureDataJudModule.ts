import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { externalDb } from '@/lib/externalDb';

/**
 * Hook para garantir que o módulo DataJud existe e está no menu
 */
export function useEnsureDataJudModule() {
  const { isAdmin } = useAuth();

  useEffect(() => {
    if (!isAdmin) return;

    const ensureModule = async () => {
      try {
        // Buscar módulos existentes
        const modules = await externalDb.getModules();
        const datajudModule = modules.find((m: any) => m.code === 'datajud');

        if (datajudModule) {
          // Módulo já existe, verificar se precisa atualizar
          if (datajudModule.route !== '/datajud' || !datajudModule.is_menu_visible) {
            await externalDb.updateModule(datajudModule.id, {
              route: '/datajud',
              is_menu_visible: true,
              menu_group: 'SISTEMA',
            });
          }
          return;
        }

        // Módulo não existe, criar
        await externalDb.createModule({
          name: 'Busca Processual',
          code: 'datajud' as any,
          description: 'Busca de processos em todos os tribunais do Brasil via DataJud',
          icon: 'Scale',
          route: '/datajud',
          menu_group: 'SISTEMA',
          is_menu_visible: true,
          display_order: 999,
          is_active: true,
        });
      } catch (error) {
        console.error('Erro ao configurar módulo DataJud:', error);
      }
    };

    ensureModule();
  }, [isAdmin]);
}
