import { useState, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { History, Loader2, User } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useCRMAuditLog,
  ENTITY_LABEL,
  ACTION_LABEL,
  type AuditEntityType,
  type AuditAction,
} from '../../hooks/useCRMAuditLog';

interface AuditLogPanelProps {
  clientId: string;
  boardId?: string;
  enabled?: boolean;
}

const ENTITY_VARIANT: Record<AuditEntityType, string> = {
  board: 'bg-blue-100 text-blue-700 border-blue-200',
  pipeline: 'bg-violet-100 text-violet-700 border-violet-200',
  automation: 'bg-amber-100 text-amber-700 border-amber-200',
  custom_field: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const ACTION_VARIANT: Record<AuditAction, string> = {
  created: 'bg-emerald-50 text-emerald-700',
  updated: 'bg-blue-50 text-blue-700',
  archived: 'bg-orange-50 text-orange-700',
  deleted: 'bg-red-50 text-red-700',
  reordered: 'bg-slate-100 text-slate-700',
  toggled_active: 'bg-purple-50 text-purple-700',
};

export function AuditLogPanel({ clientId, boardId, enabled = true }: AuditLogPanelProps) {
  const [entityFilter, setEntityFilter] = useState<AuditEntityType | 'all'>('all');
  const [actionFilter, setActionFilter] = useState<AuditAction | 'all'>('all');

  const { entries, isLoading } = useCRMAuditLog({
    clientId,
    boardId,
    entityType: entityFilter,
    action: actionFilter,
    enabled,
    limit: 200,
  });

  const grouped = useMemo(() => {
    const groups: Record<string, typeof entries> = {};
    for (const e of entries) {
      const day = format(new Date(e.created_at), 'dd/MM/yyyy', { locale: ptBR });
      if (!groups[day]) groups[day] = [];
      groups[day].push(e);
    }
    return groups;
  }, [entries]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium flex items-center gap-2">
            <History className="h-4 w-4" />
            Auditoria
          </h3>
          <p className="text-xs text-muted-foreground">
            Quem alterou o quê, quando — restrito ao perfil dono/admin
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Select value={entityFilter} onValueChange={(v) => setEntityFilter(v as AuditEntityType | 'all')}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as entidades</SelectItem>
            <SelectItem value="board">Board</SelectItem>
            <SelectItem value="pipeline">Etapa</SelectItem>
            <SelectItem value="automation">Automação</SelectItem>
            <SelectItem value="custom_field">Campo</SelectItem>
          </SelectContent>
        </Select>

        <Select value={actionFilter} onValueChange={(v) => setActionFilter(v as AuditAction | 'all')}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Ação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as ações</SelectItem>
            <SelectItem value="created">Criou</SelectItem>
            <SelectItem value="updated">Editou</SelectItem>
            <SelectItem value="archived">Arquivou</SelectItem>
            <SelectItem value="deleted">Removeu</SelectItem>
            <SelectItem value="reordered">Reordenou</SelectItem>
            <SelectItem value="toggled_active">Ativou/desativou</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed p-8 text-center">
          <History className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
          <h4 className="font-medium mb-1">Nenhum registro</h4>
          <p className="text-sm text-muted-foreground">
            As ações de criação, edição e arquivamento aparecerão aqui.
          </p>
        </div>
      ) : (
        <ScrollArea className="h-[460px] pr-2">
          <div className="space-y-5">
            {Object.entries(grouped).map(([day, items]) => (
              <div key={day}>
                <div className="text-xs font-medium text-muted-foreground mb-2 sticky top-0 bg-background py-1">
                  {day}
                </div>
                <ol className="relative border-s border-border/60 ms-2 space-y-3">
                  {items.map((entry) => (
                    <li key={entry.id} className="ms-4">
                      <span className="absolute -start-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary/70" />
                      <div className="rounded-md border bg-card p-3 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={`text-[10px] ${ENTITY_VARIANT[entry.entity_type]}`}>
                            {ENTITY_LABEL[entry.entity_type]}
                          </Badge>
                          <Badge variant="outline" className={`text-[10px] ${ACTION_VARIANT[entry.action]}`}>
                            {ACTION_LABEL[entry.action]}
                          </Badge>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {format(new Date(entry.created_at), 'HH:mm', { locale: ptBR })}
                          </span>
                        </div>
                        {entry.entity_name ? (
                          <p className="text-sm font-medium truncate">{entry.entity_name}</p>
                        ) : null}
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span>cod_agent #{entry.cod_agent}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
