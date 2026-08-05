/**
 * extend/crm — adaptador do CRM Builder para uso dentro de Escritórios.
 * Reexporta hooks de leitura e componentes de analytics existentes.
 */
export { useCRMBoards } from '@/pages/crm-builder/hooks/useCRMBoards';
export { useCRMBoardAnalytics } from '@/pages/crm-builder/hooks/useCRMBoardAnalytics';
export type { BoardAnalytics, PipelineStats } from '@/pages/crm-builder/hooks/useCRMBoardAnalytics';
export { BoardSummaryCards } from '@/pages/crm-builder/components/analytics/BoardSummaryCards';
export { PipelineFunnelChart } from '@/pages/crm-builder/components/analytics/PipelineFunnelChart';
export { PipelineAvgTimeChart } from '@/pages/crm-builder/components/analytics/PipelineAvgTimeChart';
export { DealsValueDistribution } from '@/pages/crm-builder/components/analytics/DealsValueDistribution';
export type { CRMBoard, CRMDeal, CRMPipeline } from '@/pages/crm-builder/types';