/**
 * Constante global de timezone para todo o sistema
 */
export const TIMEZONE = 'America/Sao_Paulo';

/**
 * Retorna a data atual no timezone America/Sao_Paulo no formato 'yyyy-MM-dd'
 */
export function getTodayInSaoPaulo(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

/**
 * Formata data/hora completa: "23/01/26, 17:38"
 */
export function formatDateTimeSaoPaulo(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return date.toLocaleString('pt-BR', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Formata apenas hora: "17:38"
 */
export function formatTimeSaoPaulo(timestamp: number | Date | string): string {
  const date = typeof timestamp === 'number' 
    ? new Date(timestamp) 
    : typeof timestamp === 'string' 
      ? new Date(timestamp)
      : timestamp;
  return date.toLocaleTimeString('pt-BR', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Formata data curta: "23 de jan."
 */
export function formatDateShortSaoPaulo(timestamp: number | Date | string): string {
  const date = typeof timestamp === 'number' 
    ? new Date(timestamp) 
    : typeof timestamp === 'string' 
      ? new Date(timestamp)
      : timestamp;
  return date.toLocaleDateString('pt-BR', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: 'short',
  });
}

/**
 * Formata apenas data: "23/01/2026"
 */
export function formatDateOnlySaoPaulo(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return date.toLocaleDateString('pt-BR', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Verifica se a data é hoje (no timezone de São Paulo)
 */
export function isTodaySaoPaulo(date: Date): boolean {
  const today = getTodayInSaoPaulo();
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  return dateStr === today;
}

/**
 * Verifica se a data é ontem (no timezone de São Paulo)
 */
export function isYesterdaySaoPaulo(date: Date): boolean {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatter.format(yesterday);
  const dateStr = formatter.format(date);
  
  return dateStr === yesterdayStr;
}

/**
 * Formata data com "Hoje" ou "Ontem" + hora
 */
export function formatActivityDateSaoPaulo(dateStr: string): string {
  const date = new Date(dateStr);
  const time = formatTimeSaoPaulo(date);
  
  if (isTodaySaoPaulo(date)) {
    return `Hoje, ${time}`;
  }
  
  if (isYesterdaySaoPaulo(date)) {
    return `Ontem, ${time}`;
  }
  
  return date.toLocaleDateString('pt-BR', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: '2-digit',
  }) + ' às ' + time;
}

/**
 * Agrupa por data para timeline (retorna "Hoje", "Ontem" ou "23 de janeiro")
 */
export function getDateGroupLabel(date: Date): string {
  if (isTodaySaoPaulo(date)) return 'Hoje';
  if (isYesterdaySaoPaulo(date)) return 'Ontem';
  
  return date.toLocaleDateString('pt-BR', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: 'long',
  });
}
