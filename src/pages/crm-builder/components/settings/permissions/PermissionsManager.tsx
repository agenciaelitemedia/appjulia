import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ShieldAlert, Users, UserCog, ShieldOff } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useTeamMembers } from '@/pages/equipe/hooks/useEquipeData';
import {
  getBoardPermissionMode,
  useBoardPermissions,
  useIsBoardOwner,
  type BoardPermissionRule,
  type PermissionSubjectType,
} from '../../../hooks/useCRMBoardPermissions';
import type { AppRole } from '@/types/permissions';
import { roleLabels } from '@/pages/admin/permissoes/types';
import type { BoardPermissionMode, CRMBoard } from '../../../types';
import { toast } from 'sonner';

const ROLES: AppRole[] = ['user', 'colaborador', 'time', 'advogado', 'comercial'];

type PermKey = 'can_view' | 'can_create' | 'can_edit' | 'can_delete';
const PERM_COLS: { key: PermKey; label: string }[] = [
  { key: 'can_view', label: 'Ver' },
  { key: 'can_create', label: 'Criar' },
  { key: 'can_edit', label: 'Editar' },
  { key: 'can_delete', label: 'Remover' },
];

interface Props {
  board: CRMBoard;
  clientId: string;
  onBoardUpdated: (board: CRMBoard) => void;
}

export function PermissionsManager({ board, clientId, onBoardUpdated }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isOwner = useIsBoardOwner();
  const boardId = board.id;
  const permissionMode = getBoardPermissionMode(board.settings);
  const { rules, loading, upsert, remove } = useBoardPermissions(boardId);
  const { data: teamMembers = [], isLoading: loadingUsers } = useTeamMembers();

  const rulesByKey = useMemo(() => {
    const map = new Map<string, BoardPermissionRule>();
    for (const r of rules) map.set(`${r.subject_type}:${r.subject_id}`, r);
    return map;
  }, [rules]);

  if (!isOwner) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 text-amber-600 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-amber-800 dark:text-amber-200">Acesso restrito</p>
          <p className="text-amber-700 dark:text-amber-300">
            Somente o dono do CRM ou administradores podem gerenciar permissões.
          </p>
        </div>
      </div>
    );
  }

  const handleToggle = async (
    subjectType: PermissionSubjectType,
    subjectId: string,
    key: PermKey,
    checked: boolean
  ) => {
    const existing = rulesByKey.get(`${subjectType}:${subjectId}`);
    const next = {
      can_view: existing?.can_view ?? false,
      can_create: existing?.can_create ?? false,
      can_edit: existing?.can_edit ?? false,
      can_delete: existing?.can_delete ?? false,
      [key]: checked,
    };
    if (key === 'can_view' && !checked) {
      next.can_create = false;
      next.can_edit = false;
      next.can_delete = false;
    }
    if (key !== 'can_view' && checked) {
      next.can_view = true;
    }
    const allFalse = !next.can_view && !next.can_create && !next.can_edit && !next.can_delete;
    if (allFalse && existing) {
      const success = await remove(existing.id);
      if (success) queryClient.invalidateQueries({ queryKey: ['crm-boards', clientId] });
      return;
    }
    if (allFalse) return;
    const success = await upsert(
      {
        subject_type: subjectType,
        subject_id: subjectId,
        ...next,
      },
      { clientId, createdBy: user?.name ?? null }
    );
    if (success) queryClient.invalidateQueries({ queryKey: ['crm-boards', clientId] });
  };

  const handleModeChange = async (value: string) => {
    if (value !== 'disabled' && value !== 'role' && value !== 'user') return;
    const nextMode = value as BoardPermissionMode;
    const nextSettings = {
      ...(board.settings ?? {}),
      permission_mode: nextMode,
    };
    const { data, error } = await supabase
      .from('crm_boards')
      .update({ settings: nextSettings })
      .eq('id', boardId)
      .select('*')
      .single();
    if (error) {
      toast.error('Erro ao alterar modo de permissão: ' + error.message);
      return;
    }
    if (data) onBoardUpdated(data as CRMBoard);
    queryClient.invalidateQueries({ queryKey: ['crm-boards', clientId] });
    toast.success('Modo de permissão atualizado');
  };

  const renderRow = (
    subjectType: PermissionSubjectType,
    subjectId: string,
    label: string,
    sub?: string
  ) => {
    const rule = rulesByKey.get(`${subjectType}:${subjectId}`);
    return (
      <div
        key={`${subjectType}:${subjectId}`}
        className="grid grid-cols-[minmax(0,1fr)_repeat(4,minmax(0,60px))] items-center gap-2 py-2 border-b last:border-0"
      >
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{label}</div>
          {sub && <div className="text-[11px] text-muted-foreground truncate">{sub}</div>}
        </div>
        {PERM_COLS.map((c) => (
          <div key={c.key} className="flex justify-center">
            <Checkbox
              checked={Boolean(rule?.[c.key])}
              onCheckedChange={(v) => handleToggle(subjectType, subjectId, c.key, Boolean(v))}
              aria-label={`${label} - ${c.label}`}
            />
          </div>
        ))}
      </div>
    );
  };

  const header = (
    <div className="grid grid-cols-[minmax(0,1fr)_repeat(4,minmax(0,60px))] gap-2 pb-2 border-b text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
      <div>Sujeito</div>
      {PERM_COLS.map((c) => (
        <div key={c.key} className="text-center">
          {c.label}
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Permissão por</p>
            <p className="text-xs text-muted-foreground">
              A opção escolhida define se este quadro aparece para todos, perfis específicos ou usuários específicos.
            </p>
          </div>
          <ToggleGroup
            type="single"
            value={permissionMode}
            onValueChange={handleModeChange}
            variant="outline"
            size="sm"
            className="justify-start sm:justify-end"
          >
            <ToggleGroupItem value="disabled" aria-label="Desativada">Desativada</ToggleGroupItem>
            <ToggleGroupItem value="role" aria-label="Perfil">Perfil</ToggleGroupItem>
            <ToggleGroupItem value="user" aria-label="Usuário">Usuário</ToggleGroupItem>
          </ToggleGroup>
        </div>

        <p className="text-xs text-muted-foreground">
          {permissionMode === 'disabled'
            ? 'O permissionamento está desativado: o quadro aparece para toda a equipe com acesso ao CRM Builder.'
            : 'Marque Ver para fazer o quadro aparecer e use Criar, Editar e Remover para limitar as ações dentro dele.'}
        </p>
      </div>

      {permissionMode === 'disabled' && (
        <div className="rounded-lg border bg-background p-10 text-center text-muted-foreground">
          <ShieldOff className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Permissão específica desativada</p>
          <p className="text-xs mt-1">Selecione Perfil ou Usuário para restringir a visualização deste quadro.</p>
        </div>
      )}

      {permissionMode === 'role' && (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <UserCog className="h-4 w-4" /> Por perfil
            <Badge variant="secondary" className="ml-auto text-[10px]">
              {rules.filter((r) => r.subject_type === 'role').length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {header}
          {ROLES.map((r) => renderRow('role', r, roleLabels[r] || r, `perfil "${r}"`))}
        </CardContent>
      </Card>
      )}

      {permissionMode === 'user' && (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" /> Por usuário
            <Badge variant="secondary" className="ml-auto text-[10px]">
              {rules.filter((r) => r.subject_type === 'user').length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingUsers || loading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : teamMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum membro de equipe encontrado.
            </p>
          ) : (
            <>
              {header}
              {teamMembers.map((m) => renderRow('user', String(m.id), m.name, m.email))}
            </>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  );
}