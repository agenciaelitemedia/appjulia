import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { InactiveSession } from '@/lib/externalDb';
import { JuliaStatusBadge } from '@/components/chat/JuliaStatusBadge';
import { formatInactiveLeadDate, getInactiveLeadUrgencyClass } from '../utils/inactiveLeadDate';
import { useAgentAliases } from '@/hooks/useAgentAliases';
import { useJuliaAgents } from '@/pages/estrategico/hooks/useJuliaData';
import { Hash } from 'lucide-react';

interface InactiveLeadItemProps {
  lead: InactiveSession;
  isSelected: boolean;
  onSelect: (lead: InactiveSession) => void;
}

function getInitials(name: string | null, phone: string): string {
  if (name) {
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }
  return phone.slice(-2);
}

function formatPhone(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 13) return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
  if (clean.length === 12) return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 8)}-${clean.slice(8)}`;
  return phone;
}

export function InactiveLeadItem({ lead, isSelected, onSelect }: InactiveLeadItemProps) {
  const { getAlias } = useAgentAliases();
  const { data: agents = [] } = useJuliaAgents();
  const displayName = lead.contact_name || formatPhone(lead.whatsapp_number);
  const timeLabel = formatInactiveLeadDate(lead.updated_at);
  const urgencyClass = getInactiveLeadUrgencyClass(lead.updated_at);

  const badgeColor = lead.stage_color || 'hsl(var(--muted-foreground))';
  const agentInfo = lead.cod_agent ? agents.find((a) => a.cod_agent === lead.cod_agent) : null;
  const rawAgentName = lead.cod_agent
    ? getAlias(lead.cod_agent, agentInfo?.owner_business_name || agentInfo?.owner_name)
    : '';
  const agentName = rawAgentName.length > 35 ? `${rawAgentName.slice(0, 35)}…` : rawAgentName;

  return (
    <button
      type="button"
      onClick={() => onSelect(lead)}
      className={cn(
        'w-full max-w-full overflow-hidden flex items-start gap-3 px-3 py-3 text-left transition-colors border-l-2',
        isSelected
          ? 'bg-accent/40 border-l-primary'
          : 'border-l-transparent hover:bg-accent/20'
      )}
    >
      {/* Avatar */}
      <Avatar className="h-10 w-10 shrink-0 mt-0.5">
        <AvatarFallback className="bg-muted text-muted-foreground text-sm font-semibold">
          {getInitials(lead.contact_name, lead.whatsapp_number)}
        </AvatarFallback>
      </Avatar>

      {/* Content area */}
      <div className="flex-1 min-w-0 space-y-0.5">
        {/* Row 1: Name + Time (fixed right) */}
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <JuliaStatusBadge whatsappNumber={lead.whatsapp_number} codAgent={lead.cod_agent} />
            <span className="text-sm font-medium truncate text-foreground">
              {displayName}
            </span>
          </div>
          {timeLabel && (
            <span className={cn('text-[11px] whitespace-nowrap shrink-0', urgencyClass)}>
              {timeLabel}
            </span>
          )}
        </div>

        {/* Row 2: Phone */}
        <p className="text-xs text-muted-foreground truncate">
          {formatPhone(lead.whatsapp_number)}
        </p>

        {/* Row 2.5: Cod agent + alias */}
        {lead.cod_agent && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
            <Hash className="h-3 w-3 shrink-0" />
            <span className="truncate">
              <span className="font-semibold text-foreground/80">[{lead.cod_agent}]</span>
              {agentName && <span> - {agentName}</span>}
            </span>
          </div>
        )}

        {/* Row 3: Stage badge + owner */}
        <div className="flex items-center justify-between gap-1.5 mt-0.5">
          {lead.stage_name ? (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-4 font-normal border w-fit max-w-[60%] truncate shrink-0"
              style={{
                borderColor: badgeColor,
                color: badgeColor,
                backgroundColor: lead.stage_color ? `${lead.stage_color}15` : 'hsl(var(--muted) / 0.5)',
              }}
            >
              {lead.stage_name}
            </Badge>
          ) : <span />}
          <span className="text-[10px] text-muted-foreground truncate text-right shrink min-w-0">
            {lead.owner_name || 'Sem responsável'}
          </span>
        </div>
      </div>
    </button>
  );
}
