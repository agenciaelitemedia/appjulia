import { AlertTriangle, Info, Flame, Clock, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CopilotInsight } from '@/hooks/useCopilotInsights';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const severityStyles: Record<string, string> = {
  critical: 'border-l-4 border-l-destructive bg-destructive/5',
  warning: 'border-l-4 border-l-yellow-500 bg-yellow-500/5',
  info: 'border-l-4 border-l-primary bg-primary/5',
};

const typeIcons: Record<string, typeof Info> = {
  stuck_lead: Clock,
  hot_opportunity: Flame,
  risk: AlertTriangle,
  follow_up_needed: TrendingUp,
  summary: Info,
};

interface Props {
  insight: CopilotInsight;
  onMarkAsRead: (id: string) => void;
}

export function CopilotInsightCard({ insight, onMarkAsRead }: Props) {
  const Icon = typeIcons[insight.insight_type] || Info;
  const style = severityStyles[insight.severity] || severityStyles.info;

  return (
    <div
      className={cn(
        'rounded-lg p-3 cursor-pointer transition-opacity',
        style,
        insight.is_read && 'opacity-60'
      )}
      onClick={() => !insight.is_read && onMarkAsRead(insight.id)}
    >
      <div className="flex items-start gap-2">
        <Icon className="h-4 w-4 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-tight">{insight.title}</p>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-3">
            {insight.description}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            {formatDistanceToNow(new Date(insight.created_at), {
              addSuffix: true,
              locale: ptBR,
            })}
          </p>
        </div>
        {!insight.is_read && (
          <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />
        )}
      </div>
    </div>
  );
}
