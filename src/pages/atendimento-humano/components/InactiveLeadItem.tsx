import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { differenceInMinutes, differenceInHours, differenceInDays, format, isToday, isYesterday } from 'date-fns';
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

/** WhatsApp-style timestamp: "14:35", "Ontem", "12/04/2026" */
function formatWhatsAppTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'Ontem';
  const days = differenceInDays(new Date(), date);
  if (days < 7) return format(date, 'EEEEEE', { locale: ptBR });
  return format(date, 'dd/MM/yyyy');
}

function getUrgencyColor(updatedAt: string | null): string {
  if (!updatedAt) return 'text-muted-foreground';
  const mins = differenceInMinutes(new Date(), new Date(updatedAt));
  if (mins >= 30) return 'text-red-500 font-semibold';
  if (mins >= 10) return 'text-amber-500 font-medium';
  return 'text-muted-foreground';
}

export function InactiveLeadItem({ lead, isSelected, onSelect }: InactiveLeadItemProps) {
  const displayName = lead.contact_name || formatPhone(lead.whatsapp_number);
  const timeLabel = formatWhatsAppTime(lead.updated_at);
  const urgencyClass = getUrgencyColor(lead.updated_at);

  return (
    <button
      type="button"
      onClick={() => onSelect(lead)}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-[10px] text-left transition-colors',
        isSelected
          ? 'bg-accent/50'
          : 'hover:bg-accent/20'
      )}
    >
      {/* Avatar */}
      <Avatar className="h-[49px] w-[49px] shrink-0">
        <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
          {getInitials(lead.contact_name, lead.whatsapp_number)}
        </AvatarFallback>
      </Avatar>

      {/* Content */}
      <div className="flex-1 min-w-0 border-b border-border/40 pb-[10px]">
        {/* Row 1: Name + Time */}
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[15px] font-normal truncate text-foreground">
            {displayName}
          </span>
          {timeLabel && (
            <span className={cn('text-[12px] whitespace-nowrap shrink-0', urgencyClass)}>
              {timeLabel}
            </span>
          )}
        </div>

        {/* Row 2: Phone + Stage */}
        <div className="flex items-center gap-1.5 mt-0.5">
          {lead.contact_name && (
            <span className="text-[13px] text-muted-foreground truncate">
              {formatPhone(lead.whatsapp_number)}
            </span>
          )}
          {lead.stage_name && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-4 font-normal border ml-auto shrink-0"
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
