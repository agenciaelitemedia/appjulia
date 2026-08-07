import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { XJ_STAGE_COLORS, XJ_STAGE_LABELS, type XJStage } from '../module';

export function XJStageBadge({ stage, className }: { stage?: string | null; className?: string }) {
  const key = (stage || 'recepcao') as XJStage;
  return (
    <Badge variant="outline" className={cn('border-transparent font-medium', XJ_STAGE_COLORS[key] ?? '', className)}>
      {XJ_STAGE_LABELS[key] ?? stage}
    </Badge>
  );
}

export function XJQualificationBadge({ value }: { value?: string | null }) {
  if (!value) return <span className="text-xs text-muted-foreground">—</span>;
  const map: Record<string, string> = {
    qualificado: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
    desqualificado: 'bg-rose-500/15 text-rose-600 dark:text-rose-300',
    pendente: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
  };
  return (
    <Badge variant="outline" className={cn('border-transparent font-medium capitalize', map[value] ?? '')}>
      {value}
    </Badge>
  );
}