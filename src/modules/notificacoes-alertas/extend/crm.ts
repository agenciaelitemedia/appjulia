/**
 * extend/crm — reexporta os componentes e hooks do CRM da Julia reutilizados
 * pela aba "CRM de Notificações". Nada dentro do módulo importa o CRM direto.
 */
export { UnifiedFilters } from '@/components/filters/UnifiedFilters';
export type { UnifiedFiltersState } from '@/components/filters/types';
export { CRMLeadCard } from '@/pages/crm/components/CRMLeadCard';
export { CRMScrollNavigation } from '@/pages/crm/components/CRMScrollNavigation';
export type { CRMCard, CRMStage } from '@/pages/crm/types';
export { useCRMAgents, useTeamForAgent } from '@/pages/crm/hooks/useCRMData';
export { useAgentSessionStatusesBatch } from '@/hooks/useAgentSessionStatusesBatch';
export { getInitialDates, getSavedAgentCodes } from '@/hooks/usePersistedPeriod';
export { ChatSidePanel } from '@/modules/julia-chat/chat/components/ChatSidePanel';
export { useAgentChatTarget } from '@/hooks/useAgentChatTarget';
export { useAgentAliases } from '@/hooks/useAgentAliases';
export { PhoneCallDialog } from '@/pages/crm/components/PhoneCallDialog';
export { WavoipCallButton } from '@/modules/julia-chat/chat/components/WavoipCallButton';
export { usePhone, PhoneProvider } from '@/contexts/PhoneContext';

