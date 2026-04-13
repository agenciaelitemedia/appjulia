import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { differenceInMinutes, format, isToday, isYesterday, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { InactiveSession } from '@/lib/externalDb';

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

  const badgeColor = lead.stage_color || 'hsl(var(--muted-foreground))';

  return (
    <button
      type="button"
      onClick={() => onSelect(lead)}
      className={cn(
        'w-full max-w-full overflow-hidden flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors border-l-2 border-b border-border/40',
        isSelected
          ? 'bg-accent/50 border-l-primary'
          : 'border-l-transparent hover:bg-accent/20'
      )}
    >
      {/* Avatar */}
      <Avatar className="h-9 w-9 shrink-0 mt-0.5">
        <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
          {getInitials(lead.contact_name, lead.whatsapp_number)}
        </AvatarFallback>
      </Avatar>

      {/* Content area */}
      <div className="flex-1 min-w-0 space-y-0.5">
        {/* Row 1: Name + Time (fixed right) */}
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium truncate text-foreground">
            {displayName}
          </span>
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
          {lead.owner_name && (
            <span className="text-[10px] text-muted-foreground truncate text-right shrink min-w-0">
              {lead.owner_name}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
