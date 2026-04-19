import { differenceInMinutes, differenceInDays, isToday, isYesterday } from 'date-fns';

const TZ = 'America/Sao_Paulo';

export function parseInactiveLeadDate(dateStr: string): Date {
  const value = dateStr.trim();
  const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value);

  if (hasTz) {
    const utcDate = new Date(value);
    return new Date(utcDate.toLocaleString('sv-SE', { timeZone: TZ }).replace(' ', 'T'));
  }

  return new Date(value.replace(' ', 'T'));
}

export function formatInactiveLeadDate(dateStr: string | null): string {
  if (!dateStr) return '';

  const date = parseInactiveLeadDate(dateStr);
  if (Number.isNaN(date.getTime())) return '';

  if (isToday(date)) {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: TZ,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }

  if (isYesterday(date)) return 'Ontem';

  const days = differenceInDays(new Date(), date);
  if (days < 7) {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: TZ,
      weekday: 'short',
    }).format(date).replace('.', '');
  }

  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function getInactiveLeadUrgencyClass(updatedAt: string | null): string {
  if (!updatedAt) return 'text-muted-foreground';

  const mins = differenceInMinutes(new Date(), parseInactiveLeadDate(updatedAt));
  if (mins >= 30) return 'text-red-500 font-semibold';
  if (mins >= 10) return 'text-amber-500 font-medium';
  return 'text-muted-foreground';
}