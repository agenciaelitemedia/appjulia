/**
 * Normaliza telefones brasileiros aplicando a regra do 9º dígito.
 *
 * Forma canônica para armazenamento em chat_contacts.phone:
 *   - Brasil (DDI 55): SEMPRE 13 dígitos (55 + DDD + 9 + 8 dígitos) para celulares.
 *   - Demais países: preserva os dígitos como vieram.
 *
 * Motivo: o WhatsApp historicamente entrega o JID de celulares de DDDs >= 30
 * SEM o 9º dígito (12 dígitos: 55 + DDD + 8). Para evitar duplicação entre o
 * número que vem do WhatsApp e o número real digitado pelo usuário, unificamos
 * tudo no formato com 9.
 */
export function normalizeBrPhone(raw: string | null | undefined): string {
  if (!raw) return '';
  // Remove sufixo de JID (@s.whatsapp.net, @c.us, @lid, @g.us) e tudo que não é dígito
  let d = String(raw).replace(/@.*/, '').replace(/\D/g, '');
  if (!d) return '';

  // Remove "0" de longa distância nacional se vier "055..."
  if (d.startsWith('055')) d = d.slice(1);

  // Aplica regra do 9º dígito apenas para BR
  if (d.startsWith('55') && d.length === 12) {
    const first = d[4]; // 1º dígito do número local (após DDI 55 + DDD 2 dígitos)
    if (first === '6' || first === '7' || first === '8' || first === '9') {
      // Celular sem o 9 → insere após o DDD
      d = '55' + d.slice(2, 4) + '9' + d.slice(4);
    }
  }

  return d;
}

/**
 * Retorna as variantes possíveis de um telefone BR (com e sem o 9º dígito)
 * para uso em buscas tolerantes durante o período de migração.
 */
export function brPhoneVariants(raw: string | null | undefined): string[] {
  const norm = normalizeBrPhone(raw);
  if (!norm) return [];
  const set = new Set<string>([norm]);
  // Se for BR celular 13 díg, gera também a variante de 12 díg (sem o 9)
  if (norm.startsWith('55') && norm.length === 13 && norm[4] === '9') {
    set.add('55' + norm.slice(2, 4) + norm.slice(5));
  }
  return Array.from(set);
}

/**
 * Para envio via UaZapi/Meta, alguns providers/instâncias antigas exigem o JID
 * sem o 9º dígito. Use esta função quando precisar do formato "WhatsApp legacy".
 * Por padrão a forma canônica é o número real (com 9). Use só se necessário.
 */
export function toWhatsappLegacyJid(canonical: string): string {
  const d = (canonical || '').replace(/\D/g, '');
  if (d.startsWith('55') && d.length === 13 && d[4] === '9') {
    return '55' + d.slice(2, 4) + d.slice(5);
  }
  return d;
}
