/**
 * Retorna a data atual no timezone America/Sao_Paulo no formato 'yyyy-MM-dd'
 */
export function getTodayInSaoPaulo(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}
