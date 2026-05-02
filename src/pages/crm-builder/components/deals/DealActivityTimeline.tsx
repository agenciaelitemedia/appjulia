import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowRight,
  Clock,
  Edit3,
  Plus,
  Trophy,
  XCircle,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import type { CRMDealHistory, DealHistoryAction } from '../../types';

interface DealActivityTimelineProps {
  history: CRMDealHistory[];
  isLoading: boolean;
}

const ACTION_CONFIG: Record<DealHistoryAction, {
  icon: typeof Plus;
  label: string;
  color: string;
  bgColor: string;
}> = {
  created: { icon: Plus,      label: 'Card criado',           color: 'text-primary',     bgColor: 'bg-primary/10' },
  moved:   { icon: ArrowRight, label: 'Movido de etapa',       color: 'text-blue-600',    bgColor: 'bg-blue-100' },
  updated: { icon: Edit3,      label: 'Atualizado',            color: 'text-amber-600',   bgColor: 'bg-amber-100' },
  note_added: { icon: Plus,   label: 'Anotação',              color: 'text-purple-600',  bgColor: 'bg-purple-100' },
  won:     { icon: Trophy,     label: 'Marcado como ganho',    color: 'text-primary',     bgColor: 'bg-primary/10' },
  lost:    { icon: XCircle,    label: 'Marcado como perdido',  color: 'text-destructive', bgColor: 'bg-destructive/10' },
};

const FIELD_LABELS: Record<string, string> = {
  title:                'Título',
  description:          'Descrição',
  value:                'Valor',
  contact_name:         'Nome do contato',
  contact_phone:        'Telefone',
  contact_email:        'E-mail',
  priority:             'Prioridade',
  assigned_to:          'Responsável',
  expected_close_date:  'Previsão de fechamento',
  due_date:             'Data de entrega',
  tags:                 'Tags',
  status:               'Status',
};

const PRIORITY_PT: Record<string, string> = {
  low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente',
};

const STATUS_PT: Record<string, string> = {
  open: 'Aberto', won: 'Ganho', lost: 'Perdido', archived: 'Arquivado',
};

function describeChange(key: string, value: unknown): string {
  const label = FIELD_LABELS[key] || key;

  if (value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
    return `${label} removido(a)`;
  }
  if (key === 'priority' && typeof value === 'string') {
    return `Prioridade alterada para "${PRIORITY_PT[value] || value}"`;
  }
  if (key === 'status' && typeof value === 'string') {
    return `Status alterado para "${STATUS_PT[value] || value}"`;
  }
  if (key === 'assigned_to' && typeof value === 'string') {
    return `Responsável definido como "${value}"`;
  }
  if (key === 'contact_name' && typeof value === 'string') {
    return `Nome do contato atualizado para "${value}"`;
  }
  if (key === 'value') {
    const n = Number(value);
    return Number.isFinite(n)
      ? `Valor atualizado para R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
      : 'Valor atualizado';
  }
  if (key === 'due_date' && typeof value === 'string') {
    try {
      return `Data de entrega definida para ${format(new Date(value + 'T00:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`;
    } catch { return 'Data de entrega atualizada'; }
  }
  if (key === 'expected_close_date' && typeof value === 'string') {
    try {
      return `Previsão de fechamento: ${format(new Date(value + 'T00:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`;
    } catch { return 'Previsão de fechamento atualizada'; }
  }
  if (key === 'tags' && Array.isArray(value)) {
    return value.length > 0 ? `Tags: ${(value as string[]).join(', ')}` : 'Tags removidas';
  }
  return `${label} atualizado(a)`;
}

function getChangesDescription(changes: Record<string, unknown>): string[] {
  return Object.entries(changes)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => describeChange(k, v));
}

function UserBadge({ changedBy }: { changedBy?: string }) {
  if (!changedBy) return null;
  const initial = changedBy.charAt(0).toUpperCase();
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">
      <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary/20 text-primary font-semibold text-[9px]">
        {initial}
      </span>
      <User className="h-2.5 w-2.5" />
      {changedBy}
    </span>
  );
}

export function DealActivityTimeline({ history, isLoading }: DealActivityTimelineProps) {
  // Only show non-note events
  const events = history.filter((h) => h.action !== 'note_added');

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Nenhuma atividade registrada</p>
      </div>
    );
  }

  return (
    <div className="relative space-y-4">
      <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-border" />

      {events.map((item) => {
        const config = ACTION_CONFIG[item.action as DealHistoryAction] || ACTION_CONFIG.updated;
        const Icon = config.icon;
        const changes = item.changes && typeof item.changes === 'object'
          ? getChangesDescription(item.changes as Record<string, unknown>)
          : [];

        return (
          <div key={item.id} className="relative flex gap-3 pl-0">
            <div className={cn(
              'relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full',
              config.bgColor
            )}>
              <Icon className={cn('h-4 w-4', config.color)} />
            </div>

            <div className="flex-1 min-w-0 pt-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{config.label}</span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(item.changed_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
              </div>

              {item.changed_by && (
                <div className="mt-0.5">
                  <UserBadge changedBy={item.changed_by} />
                </div>
              )}

              {/* Movimento entre etapas */}
              {item.action === 'moved' && item.from_pipeline_name && item.to_pipeline_name && (
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <span
                    className="px-2 py-0.5 rounded text-xs font-medium"
                    style={{ backgroundColor: `${item.from_pipeline_color}20`, color: item.from_pipeline_color }}
                  >
                    {item.from_pipeline_name}
                  </span>
                  <ArrowRight className="h-3 w-3" />
                  <span
                    className="px-2 py-0.5 rounded text-xs font-medium"
                    style={{ backgroundColor: `${item.to_pipeline_color}20`, color: item.to_pipeline_color }}
                  >
                    {item.to_pipeline_name}
                  </span>
                </div>
              )}

              {/* Campos alterados traduzidos */}
              {item.action === 'updated' && changes.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {changes.map((desc, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                      <span className="inline-block h-1 w-1 rounded-full bg-muted-foreground/50 flex-shrink-0" />
                      {desc}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
