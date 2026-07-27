import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Settings2, Shield } from 'lucide-react';
import { PermissionsManager } from './components/settings/permissions/PermissionsManager';
import { useIsBoardOwner } from './hooks/useCRMBoardPermissions';
import type { CRMBoard } from './types';
import { toast } from 'sonner';

export default function BoardSettingsPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : '';
  const isOwner = useIsBoardOwner();

  const [board, setBoard] = useState<CRMBoard | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchBoard = async () => {
      if (!boardId) return;
      setIsLoading(true);
      const { data, error } = await supabase
        .from('crm_boards')
        .select('*')
        .eq('id', boardId)
        .maybeSingle();
      if (cancelled) return;
      setIsLoading(false);
      if (error) {
        toast.error('Erro ao carregar quadro: ' + error.message);
        return;
      }
      if (!data) {
        navigate('/crm-builder', { replace: true });
        return;
      }
      // Escopo por client_id (mesmo padrão do restante do módulo)
      if (clientId && String((data as CRMBoard).client_id) !== clientId && !isOwner) {
        navigate('/crm-builder', { replace: true });
        return;
      }
      setBoard(data as CRMBoard);
    };
    fetchBoard();
    return () => {
      cancelled = true;
    };
  }, [boardId, clientId, isOwner, navigate]);

  const defaultTab = isOwner ? 'permissions' : 'general';

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/crm-builder/${boardId}`)}
          aria-label="Voltar"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="p-2 rounded-lg bg-primary/10">
          <Settings2 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Configurações{board ? `: ${board.name}` : ''}
          </h1>
          <p className="text-sm text-muted-foreground">
            Ajustes gerais e permissões do quadro
          </p>
        </div>
      </div>

      {isLoading || !board ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="general" className="gap-2">
              <Settings2 className="h-4 w-4" />
              Geral
            </TabsTrigger>
            <TabsTrigger value="permissions" className="gap-2">
              <Shield className="h-4 w-4" />
              Permissões
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-6">
            <div className="rounded-lg border bg-muted/20 p-10 text-center text-muted-foreground">
              <Settings2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Configurações gerais do quadro</p>
              <p className="text-xs mt-1">Em breve: cores, ícone, arquivar quadro</p>
            </div>
          </TabsContent>

          <TabsContent value="permissions" className="mt-6">
            {isOwner ? (
              <PermissionsManager boardId={board.id} clientId={clientId} />
            ) : (
              <div className="rounded-lg border bg-muted/20 p-10 text-center text-muted-foreground">
                <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Você não tem permissão para gerenciar permissões deste quadro</p>
                <p className="text-xs mt-1">Apenas o dono do CRM ou um administrador pode alterar essas configurações.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}