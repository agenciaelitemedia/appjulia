/**
 * Render preview de máscara de protocolo no client-side.
 * Tokens: AAAA, AA, MM, DD, HH, II, S+ (seq mês), N+ (seq dia).
 * Para preview, S/N usam `previewSeq` (default 1).
 */
export function renderProtocolMaskPreview(mask: string, previewSeq = 1, now = new Date()): string {
  const safe = mask && mask.trim() ? mask : 'AAAAMMDDNNNNNN';
  // Converte para horário de Brasília (-03:00)
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  const yyyy = String(brt.getUTCFullYear());
  const yy = yyyy.slice(-2);
  const mm = pad(brt.getUTCMonth() + 1);
  const dd = pad(brt.getUTCDate());
  const hh = pad(brt.getUTCHours());
  const ii = pad(brt.getUTCMinutes());

  let out = '';
  let i = 0;
  while (i < safe.length) {
    const ch = safe[i];
    if (ch === 'A' && safe.substr(i, 4) === 'AAAA') { out += yyyy; i += 4; continue; }
    if (ch === 'A' && safe.substr(i, 2) === 'AA') { out += yy; i += 2; continue; }
    if (ch === 'M' && safe.substr(i, 2) === 'MM') { out += mm; i += 2; continue; }
    if (ch === 'D' && safe.substr(i, 2) === 'DD') { out += dd; i += 2; continue; }
    if (ch === 'H' && safe.substr(i, 2) === 'HH') { out += hh; i += 2; continue; }
    if (ch === 'I' && safe.substr(i, 2) === 'II') { out += ii; i += 2; continue; }
    if (ch === 'S' || ch === 'N') {
      let run = 0;
      while (i + run < safe.length && safe[i + run] === ch) run++;
      out += String(previewSeq).padStart(run, '0');
      i += run;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}