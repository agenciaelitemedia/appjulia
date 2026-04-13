import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { InactiveSession } from '@/lib/externalDb';

interface InactiveLeadItemProps {
  lead: InactiveSession;
  isSelected: boolean;
  onSelect: (lead: InactiveSession) => void;
}

function getInitials(name: string | null, phone: string): string {
  if (name) {
    return name
      .split(' ')
      .slice(0, 2)
      .map(w => w[0])
      .join('')
      .toUpperCase();
  }
  return phone.slice(-2);
}

function formatPhone(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 13) {
    return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
  }
  if (clean.length === 12) {
    return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 8)}-${clean.slice(8)}`;
  }
  return phone;
}

export function InactiveLeadItem({ lead, isSelected, onSelect }: InactiveLeadItemProps) {
  const displayName = lead.contact_name || formatPhone(lead.whatsapp_number);
  const timeAgo = lead.updated_at
    ? formatDistanceToNow(new Date(lead.updated_at), { addSuffix: true, locale: ptBR })
    : '';

  return (
    <button
      type="button"
      onClick={() => onSelect(lead)}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50',
        isSelected && 'bg-muted/70 border-l-2 border-l-primary'
      )}
    >
      <Avatar className="h-10 w-10 shrink-0 bg-primary/10">
        <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
          {getInitials(lead.contact_name, lead.whatsapp_number)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium truncate">{displayName}</span>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{timeAgo}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {lead.contact_name && (
            <span className="text-xs text-muted-foreground truncate">
              {formatPhone(lead.whatsapp_number)}
            </span>
          )}
        </div>

        {lead.stage_name && (
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 h-4 font-normal border"
            style={{
              borderColor: lead.stage_color || undefined,
              color: lead.stage_color || undefined,
              backgroundColor: lead.stage_color ? `${lead.stage_color}15` : undefined,
            }}
          >
            {lead.stage_name}
          </Badge>
        )}
      </div>
    </button>
  );
}
