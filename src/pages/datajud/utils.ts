import type { SearchType } from './types';

/**
 * Detect the type of search based on input
 */
export function detectSearchType(input: string): SearchType {
  const clean = input.replace(/\D/g, '');
  
  // CNJ process number format: NNNNNNN-DD.AAAA.J.TR.OOOO (20 digits when clean)
  if (clean.length === 20 || /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/.test(input)) {
    return 'process_number';
  }
  
  // CNPJ: 14 digits
  if (clean.length === 14) {
    return 'document';
  }
  
  // CPF: 11 digits
  if (clean.length === 11) {
    return 'document';
  }
  
  // OAB: starts with state abbreviation + numbers
  if (/^[A-Za-z]{2}\s*\d+/.test(input) || /^OAB\s*[\/\\]?\s*[A-Za-z]{2}/i.test(input)) {
    return 'lawyer';
  }
  
  // Default to process number if it looks like a process
  if (input.includes('.') && input.includes('-')) {
    return 'process_number';
  }
  
  // If it's mostly numbers, assume document
  if (clean.length >= 8 && clean.length <= 14) {
    return 'document';
  }
  
  return 'process_number';
}

/**
 * Format CNJ process number
 */
export function formatProcessNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 20);
  
  if (digits.length <= 7) return digits;
  if (digits.length <= 9) return `${digits.slice(0, 7)}-${digits.slice(7)}`;
  if (digits.length <= 13) return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9)}`;
  if (digits.length <= 14) return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13)}`;
  if (digits.length <= 16) return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14)}`;
  
  return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16)}`;
}

/**
 * Format CNPJ
 */
export function formatCNPJ(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

/**
 * Format CPF
 */
export function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

/**
 * Format OAB number
 */
export function formatOAB(value: string): string {
  // Keep UF prefix and format number
  const match = value.match(/^([A-Za-z]{2})\s*(\d+)/);
  if (match) {
    const [, uf, number] = match;
    return `${uf.toUpperCase()} ${number}`;
  }
  return value.toUpperCase();
}

/**
 * Apply appropriate mask based on search type
 */
export function applyMask(value: string, type: SearchType): string {
  switch (type) {
    case 'process_number':
      return formatProcessNumber(value);
    case 'document': {
      const digits = value.replace(/\D/g, '');
      if (digits.length <= 11) return formatCPF(value);
      return formatCNPJ(value);
    }
    case 'lawyer':
      return formatOAB(value);
    default:
      return value;
  }
}

/**
 * Get placeholder text for search type
 */
export function getPlaceholder(type: SearchType): string {
  switch (type) {
    case 'process_number':
      return '0001234-56.2024.8.26.0100';
    case 'document':
      return '12.345.678/0001-99 ou 123.456.789-00';
    case 'lawyer':
      return 'SP 123456 ou OAB/SP 123.456';
    default:
      return 'Digite sua busca...';
  }
}

/**
 * Get label for search type
 */
export function getSearchTypeLabel(type: SearchType): string {
  switch (type) {
    case 'process_number':
      return 'Número do Processo';
    case 'document':
      return 'CPF/CNPJ';
    case 'lawyer':
      return 'OAB';
    default:
      return 'Busca';
  }
}

/**
 * Format date to Brazilian format
 */
export function formatDate(dateString: string): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

/**
 * Format date and time to Brazilian format
 */
export function formatDateTime(dateString: string): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

/**
 * Format currency
 */
export function formatCurrency(value: number | undefined): string {
  if (value === undefined || value === null) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Extract tribunal code from process number
 */
export function extractTribunalFromProcess(processNumber: string): string | null {
  // CNJ format: NNNNNNN-DD.AAAA.J.TR.OOOO
  // J = Justiça (1-9), TR = Tribunal (00-99)
  const match = processNumber.match(/\d{7}-\d{2}\.\d{4}\.(\d)\.(\d{2})\.\d{4}/);
  if (match) {
    const [, justica, tribunal] = match;
    // Map to tribunal codes based on justice type and number
    // This is a simplified mapping
    if (justica === '8') {
      // Justiça Estadual
      const tjMap: Record<string, string> = {
        '01': 'TJAC', '02': 'TJAL', '03': 'TJAP', '04': 'TJAM', '05': 'TJBA',
        '06': 'TJCE', '07': 'TJDFT', '08': 'TJES', '09': 'TJGO', '10': 'TJMA',
        '11': 'TJMT', '12': 'TJMS', '13': 'TJMG', '14': 'TJPA', '15': 'TJPB',
        '16': 'TJPR', '17': 'TJPE', '18': 'TJPI', '19': 'TJRJ', '20': 'TJRN',
        '21': 'TJRS', '22': 'TJRO', '23': 'TJRR', '24': 'TJSC', '25': 'TJSE',
        '26': 'TJSP', '27': 'TJTO',
      };
      return tjMap[tribunal] || null;
    }
    if (justica === '4') {
      // Justiça Federal
      return `TRF${parseInt(tribunal, 10)}`;
    }
    if (justica === '5') {
      // Justiça do Trabalho
      return `TRT${parseInt(tribunal, 10)}`;
    }
  }
  return null;
}

/**
 * Get tribunal badge color based on category
 */
export function getTribunalColor(category: string): string {
  const colors: Record<string, string> = {
    Superior: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    Federal: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    Estadual: 'bg-green-500/10 text-green-500 border-green-500/20',
    Trabalhista: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    Eleitoral: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
    Militar: 'bg-red-500/10 text-red-500 border-red-500/20',
  };
  return colors[category] || 'bg-muted text-muted-foreground border-border';
}
