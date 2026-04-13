import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { differenceInMinutes, differenceInHours, differenceInDays } from 'date-fns';
import { Clock } from 'lucide-react';
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

function getUrgencyStyle(updatedAt: string | null) {
  if (!updatedAt) return { className: 'text-muted-foreground', badge: '' };
  const mins = differenceInMinutes(new Date(), new Date(updatedAt));
  if (mins >= 30) return { className: 'text-red-600 font-semibold', badge: 'bg-red-500/10 text-red-600 border-red-200' };
  if (mins >= 10) return { className: 'text-amber-600 font-medium', badge: 'bg-amber-500/10 text-amber-600 border-amber-200' };
  return { className: 'text-muted-foreground', badge: '' };
}

function formatShortTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const mins = differenceInMinutes(now, date);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min`;
  const hours = differenceInHours(now, date);
  if (hours < 24) return `${hours}h`;
  const days = differenceInDays(now, date);
  return `${days}d`;
}

export function InactiveLeadItem({ lead, isSelected, onSelect }: InactiveLeadItemProps) {
  const displayName = lead.contact_name || formatPhone(lead.whatsapp_number);
  const timeAgo = formatShortTime(lead.updated_at);
  const urgency = getUrgencyStyle(lead.updated_at);

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
          {timeAgo && (
            <span className={cn('flex items-center gap-1 text-[11px] whitespace-nowrap shrink-0', urgency.className)}>
              <Clock className="h-3 w-3" />
              {timeAgo}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {lead.contact_name && (
            <span className="text-xs text-muted-foreground truncate">
              {formatPhone(lead.whatsapp_number)}
            </span>
          )}
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
      </div>
    </button>
  );
}
