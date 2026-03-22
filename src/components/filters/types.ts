export interface Agent {
  cod_agent: string;
  owner_name: string;
  owner_business_name?: string;
}

export interface CustomSelectConfig {
  key: string;
  placeholder: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  width?: string;
}

export interface UnifiedFiltersState {
  search: string;
  agentCodes: string[];
  dateFrom: string;
  dateTo: string;
  // Campos opcionais para filtros específicos
  perfilAgent?: 'SDR' | 'CLOSER' | 'ALL';
  statusDocument?: string;
  stateFilter?: string;
}

export interface UnifiedFiltersProps {
  // Dados
  agents: Agent[];
  filters: UnifiedFiltersState;
  onFiltersChange: (filters: UnifiedFiltersState) => void;
  
  // Estado
  isLoading?: boolean;
  
  // Configurações de visibilidade
  showAgentSelector?: boolean;      // default: true
  showSearch?: boolean;             // default: true
  showQuickPeriods?: boolean;       // default: true
  
  // Filtros extras opcionais
  showPerfilFilter?: boolean;       // Para página de Desempenho
  showStatusFilter?: boolean;       // Para página de Contratos
  statusOptions?: string[];
  showStateFilter?: boolean;        // Para página de FollowUp
  stateOptions?: { value: string; label: string }[];
  
  // Selects customizados genéricos
  customSelects?: CustomSelectConfig[];
  
  // Personalização
  searchPlaceholder?: string;
  className?: string;
  
  // Tooltip explicativo para o filtro de período
  periodTooltip?: string;
}
