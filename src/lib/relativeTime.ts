export function formatRelativePtBR(date: string | Date | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  const ms = Date.now() - d.getTime();
  if (Number.isNaN(ms) || ms < 0) return '';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return 'ativo agora';
  const min = Math.floor(sec / 60);
  if (min < 60) return `ativo há ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `ativo há ${hr} h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `ativo há ${day} d`;
  return 'ativo há +7 d';
}