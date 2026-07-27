import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, Users, UserCog } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useTeamMembers } from '@/pages/equipe/hooks/useEquipeData';
import {
  useBoardPermissions,
  useIsBoardOwner,
  type BoardPermissionRule,
  type PermissionSubjectType,
} from '../../../hooks/useCRMBoardPermissions';
import type { AppRole } from '@/types/permissions';
import { roleLabels } from '@/pages/admin/permissoes/types';

const ROLES: AppRole[] = ['user', 'colaborador', 'time', 'advogado', 'comercial'];

type PermKey = 'can_view' | 'can_create' | 'can_edit' | 'can_delete';
const PERM_COLS: { key: PermKey; label: string }[] = [
  { key: 'can_view', label: 'Ver' },
  { key: 'can_create', label: 'Criar' },
  { key: 'can_edit', label: 'Editar' },
  { key: 'can_delete', label: 'Remover' },
];

interface Props {
  boardId: string;
  clientId: string;
}

export function PermissionsManager({ boardId, clientId }: Props) {
  const { user } = useAuth();
  const isOwner = useIsBoardOwner();
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
    const allFalse = !next.can_view && !next.can_create && !next.can_edit && !next.can_delete;
    if (allFalse && existing) {
      await remove(existing.id);
      return;
    }
    await upsert(
      {
        subject_type: subjectType,
        subject_id: subjectId,
        ...next,
      },
      { clientId, createdBy: user?.name ?? null }
    );
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
      <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
        <p>
          Configure quem pode <strong>ver</strong>, <strong>criar</strong>,{' '}
          <strong>editar</strong> ou <strong>remover</strong> cards deste CRM. Regras por
          usuário e por perfil somam entre si (OR). Sem nenhuma regra, o CRM permanece
          aberto a toda a equipe. Administradores e o dono do cliente têm acesso total.
        </p>
      </div>

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
    </div>
  );
}