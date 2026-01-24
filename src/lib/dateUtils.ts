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

// ============================================
// FUNÇÕES PARA TIMESTAMPS DO BANCO EXTERNO
// ============================================
// O sistema externo (JulIA) salva horários de Brasília diretamente
// no banco SEM offset, mas com sufixo 'Z' (interpretado como UTC).
// Precisamos tratar esses timestamps como já estando em Brasília.

/**
 * Interpreta um timestamp do banco como se já estivesse em Brasília.
 * 
 * PROBLEMA: O sistema externo salva horários de Brasília como UTC.
 * Exemplo: 20:38 Brasília é salvo como "2026-01-23T20:38:26Z"
 *          Quando parseado, JavaScript interpreta como UTC e converte errado.
 * 
 * SOLUÇÃO: Remover o Z e tratar como timestamp local.
 */
export function parseDbTimestamp(dateStr: string | Date): Date {
  if (dateStr instanceof Date) return dateStr;
  
  // Remove o Z final se existir (para não interpretar como UTC)
  const cleanStr = dateStr.replace(/Z$/, '');
  return new Date(cleanStr);
}

/**
 * Formata um timestamp do banco para exibição completa.
 * Use esta função para timestamps que vêm do banco externo.
 * Formato: "23/01/26, 20:38"
 */
export function formatDbDateTime(dateStr: string | Date): string {
  const date = parseDbTimestamp(dateStr);
  
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Formata apenas hora de um timestamp do banco.
 * Formato: "20:38"
 */
export function formatDbTime(dateStr: string | Date): string {
  const date = parseDbTimestamp(dateStr);
  
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Formata data curta de um timestamp do banco.
 * Formato: "23 de jan."
 */
export function formatDbDateShort(dateStr: string | Date): string {
  const date = parseDbTimestamp(dateStr);
  
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });
}

/**
 * Verifica se o timestamp do banco é hoje
 */
export function isDbTimestampToday(dateStr: string | Date): boolean {
  const date = parseDbTimestamp(dateStr);
  const today = new Date();
  
  return date.getDate() === today.getDate() &&
         date.getMonth() === today.getMonth() &&
         date.getFullYear() === today.getFullYear();
}

/**
 * Verifica se o timestamp do banco é ontem
 */
export function isDbTimestampYesterday(dateStr: string | Date): boolean {
  const date = parseDbTimestamp(dateStr);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  return date.getDate() === yesterday.getDate() &&
         date.getMonth() === yesterday.getMonth() &&
         date.getFullYear() === yesterday.getFullYear();
}

/**
 * Retorna label de agrupamento para timeline de banco externo
 * Formato: "Hoje", "Ontem" ou "23 de janeiro"
 */
export function getDbDateGroupLabel(dateStr: string | Date): string {
  if (isDbTimestampToday(dateStr)) return 'Hoje';
  if (isDbTimestampYesterday(dateStr)) return 'Ontem';
  
  const date = parseDbTimestamp(dateStr);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
  });
}

/**
 * Calcula a diferença de tempo entre duas datas e retorna string amigável.
 * Exemplos: "em 3 min", "há 50 min", "há 2 dias", "em 1h 23min"
 * 
 * @param startDate - Data de início (criação do contrato)
 * @param endDate - Data de fim (assinatura). Se null/undefined, usa a data atual
 * @returns String formatada com prefixo "em" (para passado/assinado) ou "há" (para em curso)
 */
export function formatTimeDifference(
  startDate: string | Date, 
  endDate?: string | Date | null
): string {
  const start = parseDbTimestamp(startDate);
  const end = endDate ? parseDbTimestamp(endDate) : new Date();
  
  const diffMs = end.getTime() - start.getTime();
  const diffMinutes = Math.floor(Math.abs(diffMs) / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  // Determina prefixo: "em" para passado (assinado), "há" para em curso
  const prefix = endDate ? 'em' : 'há';
  
  if (diffDays > 0) {
    return `${prefix} ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
  }
  
  if (diffHours > 0) {
    const remainingMinutes = diffMinutes % 60;
    if (remainingMinutes > 0) {
      return `${prefix} ${diffHours}h ${remainingMinutes}min`;
    }
    return `${prefix} ${diffHours}h`;
  }
  
  return `${prefix} ${diffMinutes} min`;
}

/**
 * Retorna a data de X dias atrás no timezone America/Sao_Paulo no formato 'yyyy-MM-dd'
 */
export function getDaysAgoInSaoPaulo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Retorna a data de ontem no timezone America/Sao_Paulo no formato 'yyyy-MM-dd'
 */
export function getYesterdayInSaoPaulo(): string {
  return getDaysAgoInSaoPaulo(1);
}

/**
 * Retorna a data de 7 dias atrás no timezone America/Sao_Paulo no formato 'yyyy-MM-dd'
 */
export function get7DaysAgoInSaoPaulo(): string {
  return getDaysAgoInSaoPaulo(7);
}
/**
 * Retorna a data de 30 dias atrás no timezone America/Sao_Paulo no formato 'yyyy-MM-dd'
 */
export function get30DaysAgoInSaoPaulo(): string {
  return getDaysAgoInSaoPaulo(30);
}

/**
 * Retorna a data de 3 meses atrás no timezone America/Sao_Paulo no formato 'yyyy-MM-dd'
 */
export function get3MonthsAgoInSaoPaulo(): string {
  const date = new Date();
  date.setMonth(date.getMonth() - 3);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Retorna o primeiro dia da semana passada (segunda-feira) no timezone America/Sao_Paulo
 */
export function getLastWeekStartInSaoPaulo(): string {
  const date = new Date();
  const dayOfWeek = date.getDay();
  // Go back to last Monday (if today is Monday, go back 7 days)
  const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  date.setDate(date.getDate() - daysToLastMonday - 7);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Retorna o último dia da semana passada (domingo) no timezone America/Sao_Paulo
 */
export function getLastWeekEndInSaoPaulo(): string {
  const date = new Date();
  const dayOfWeek = date.getDay();
  // Go back to last Sunday
  const daysToLastSunday = dayOfWeek === 0 ? 7 : dayOfWeek;
  date.setDate(date.getDate() - daysToLastSunday);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Retorna o primeiro dia do mês atual no timezone America/Sao_Paulo no formato 'yyyy-MM-dd'
 */
export function getFirstDayOfMonthInSaoPaulo(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  // Get current month/year in São Paulo timezone
  const parts = formatter.formatToParts(now);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  
  return `${year}-${month}-01`;
}

/**
 * Retorna o último dia do mês atual no timezone America/Sao_Paulo no formato 'yyyy-MM-dd'
 */
export function getLastDayOfMonthInSaoPaulo(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  // Get current month/year in São Paulo timezone
  const parts = formatter.formatToParts(now);
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '2026');
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '1');
  
  // Create date for last day of month
  const lastDay = new Date(year, month, 0);
  return formatter.format(lastDay);
}
