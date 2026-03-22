/**
 * Formata números de telefone brasileiros para o padrão Api4Com: 0 + DDD + número
 */

export interface PhoneFormatResult {
  formatted: string;
  type: 'mobile' | 'landline' | 'unknown';
  ninthAdded: boolean;
}

export function formatPhoneForDialing(raw: string): PhoneFormatResult {
  // Remove tudo que não é dígito
  let digits = raw.replace(/\D/g, '');

  // Remove prefixo internacional 55
  if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.slice(2);
  }

  // Remove zero de longa distância se presente
  if (digits.startsWith('0') && digits.length >= 11) {
    digits = digits.slice(1);
  }

  let ninthAdded = false;
  let type: PhoneFormatResult['type'] = 'unknown';

  if (digits.length === 11) {
    // DDD (2) + 9 dígitos = celular completo
    type = 'mobile';
  } else if (digits.length === 10) {
    const ddd = digits.slice(0, 2);
    const firstLocal = digits[2];

    if (['6', '7', '8', '9'].includes(firstLocal)) {
      // Celular sem nono dígito → adiciona 9
      digits = ddd + '9' + digits.slice(2);
      ninthAdded = true;
      type = 'mobile';
    } else {
      // Fixo (começa com 2-5)
      type = 'landline';
    }
  } else if (digits.length === 8 || digits.length === 9) {
    // Número sem DDD — não conseguimos formatar corretamente
    type = digits.length === 9 ? 'mobile' : 'unknown';
  }

  // Adiciona 0 na frente (padrão Api4Com)
  const formatted = digits.startsWith('0') ? digits : '0' + digits;

  return { formatted, type, ninthAdded };
}
