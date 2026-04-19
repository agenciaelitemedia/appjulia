import { differenceInCalendarDays, differenceInMinutes, isSameDay } from 'date-fns';

const TZ = 'America/Sao_Paulo';

export function parseInactiveLeadDate(dateStr: string): Date {
  const match = dateStr
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?/);

  if (!match) return new Date(Number.NaN);

  const [, year, month, day, hour, minute, second = '0', ms = '0'] = match;

  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
      Number(ms.padEnd(3, '0'))
    )
  );
}

function getSaoPauloNow(): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? '0');

  return new Date(Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')));
}

export function formatInactiveLeadDate(dateStr: string | null): string {
  if (!dateStr) return '';

  const date = parseInactiveLeadDate(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  const now = getSaoPauloNow();

  if (isSameDay(date, now)) {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }

  if (differenceInCalendarDays(now, date) === 1) return 'Ontem';

  const days = differenceInCalendarDays(now, date);
  if (days < 7) {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'UTC',
      weekday: 'short',
    }).format(date).replace('.', '');
  }

  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function getInactiveLeadUrgencyClass(updatedAt: string | null): string {
  if (!updatedAt) return 'text-muted-foreground';

  const mins = differenceInMinutes(getSaoPauloNow(), parseInactiveLeadDate(updatedAt));
  if (mins >= 30) return 'text-red-500 font-semibold';
  if (mins >= 10) return 'text-amber-500 font-medium';
  return 'text-muted-foreground';
}