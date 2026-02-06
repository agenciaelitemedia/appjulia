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
