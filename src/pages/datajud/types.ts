// Types for DataJud search module

export type SearchType = 'process_number' | 'document' | 'lawyer';

export type TribunalCategory = 'Superior' | 'Federal' | 'Estadual' | 'Trabalhista' | 'Eleitoral' | 'Militar';

export interface Tribunal {
  key: string;
  endpoint: string;
  name: string;
  category: TribunalCategory;
}

export interface ProcessMovement {
  codigo: number;
  nome: string;
  dataHora: string;
  complementosTabelados?: Array<{
    codigo: number;
    nome: string;
    valor?: number;
    descricao?: string;
  }>;
}

export interface ProcessClass {
  codigo: number;
  nome: string;
}

export interface ProcessSubject {
  codigo: number;
  nome: string;
}

export interface ProcessCourt {
  codigo: number;
  nome: string;
}

export interface ProcessData {
  numeroProcesso: string;
  classe: ProcessClass;
  assuntos: ProcessSubject[];
  tribunal: string;
  dataAjuizamento: string;
  grau: string;
  orgaoJulgador: ProcessCourt;
  movimentos: ProcessMovement[];
  valorCausa?: number;
  formato?: { codigo: number; nome: string };
  sistema?: { codigo: number; nome: string };
}

export interface ProcessHit {
  _index: string;
  _id: string;
  _score: number;
  _source: ProcessData;
}

export interface TribunalResult {
  tribunal: string;
  hits: ProcessHit[];
  total: number;
  error?: string;
}

export interface SearchResponse {
  results: TribunalResult[];
  totalResults: number;
  searchedTribunals: number;
  responseTime: number;
}

export interface SearchState {
  isSearching: boolean;
  searchType: SearchType;
  query: string;
  selectedTribunals: string[];
  results: TribunalResult[];
  totalResults: number;
  searchedTribunals: number;
  responseTime: number;
  error: string | null;
}

export interface ProcessDetailsState {
  isOpen: boolean;
  process: ProcessData | null;
  tribunal: string | null;
}

// === Monitoring Types ===

export interface MonitoredProcess {
  id: string;
  user_id: number;
  process_number: string;
  process_number_formatted: string;
  name: string;
  client_phone: string | null;
  tribunal: string | null;
  last_known_movements: any[];
  last_check_at: string | null;
  status: 'active' | 'paused' | 'error';
  created_at: string;
  updated_at: string;
}

export interface NotificationConfig {
  id: string;
  user_id: number;
  default_agent_cod: string | null;
  office_phones: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProcessAlert {
  id: string;
  process_id: string;
  user_id: number;
  movement_data: any;
  is_read: boolean;
  whatsapp_sent: boolean;
  whatsapp_error: string | null;
  created_at: string;
  // joined
  process?: MonitoredProcess;
}

export interface BulkImportLine {
  line: number;
  raw: string;
  processNumber: string;
  processNumberClean: string;
  name: string;
  phone: string;
  valid: boolean;
  error?: string;
}

export function formatProcessNumber(digits: string): string {
  if (digits.length !== 20) return digits;
  return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
}

export function validateProcessNumber(input: string): { valid: boolean; clean: string; formatted: string; error?: string } {
  const clean = input.replace(/\D/g, '');
  if (clean.length !== 20) {
    return { valid: false, clean, formatted: input, error: 'Número deve ter 20 dígitos' };
  }
  return { valid: true, clean, formatted: formatProcessNumber(clean) };
}

export function parseBulkImportLine(raw: string, lineNumber: number): BulkImportLine {
  const parts = raw.split(',').map(p => p.trim());
  if (parts.length < 2) {
    return { line: lineNumber, raw, processNumber: '', processNumberClean: '', name: '', phone: '', valid: false, error: 'Formato: numero, nome, telefone' };
  }
  const processNumber = parts[0];
  const name = parts[1];
  const phone = parts[2] || '';
  const validation = validateProcessNumber(processNumber);
  if (!validation.valid) {
    return { line: lineNumber, raw, processNumber, processNumberClean: validation.clean, name, phone, valid: false, error: validation.error };
  }
  if (!name) {
    return { line: lineNumber, raw, processNumber: validation.formatted, processNumberClean: validation.clean, name, phone, valid: false, error: 'Nome é obrigatório' };
  }
  return { line: lineNumber, raw, processNumber: validation.formatted, processNumberClean: validation.clean, name, phone, valid: true };
}
