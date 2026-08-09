import { Info, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  XJ_ROLE_DESCRIPTIONS,
  XJ_ROLE_LABELS,
  type XJAgentRole,
} from '../lib/agentRolePresets';

/** Explica o papel do agente e alerta configuração faltando. */
export function XJRoleBanner({
  role,
  caseName,
  warning,
}: {
  role: XJAgentRole;
  caseName?: string | null;
  warning?: string | null;
}) {
  return (
    <div className="mb-4 space-y-2">
      <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={role === 'specialist' ? 'outline' : 'secondary'}>{XJ_ROLE_LABELS[role]}</Badge>
            {role === 'specialist' && caseName && <Badge variant="outline">{caseName}</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">{XJ_ROLE_DESCRIPTIONS[role]}</p>
        </div>
      </div>
      {warning && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-xs text-destructive">{warning}</p>
        </div>
      )}
    </div>
  );
}
