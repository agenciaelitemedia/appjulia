/**
 * extend/wabaTemplates — reuso da infra de templates da API Oficial (Meta/WABA)
 * já existente na Julia. Nenhuma lógica de API é duplicada aqui.
 */
export {
  useWabaQueues,
  useWabaTemplatesCache,
  useSyncTemplates,
  useDeleteTemplate,
  useCreateTemplate,
  useUploadMediaHandle,
} from '@/modules/julia-chat/pages/config/waba-templates/useWabaTemplates';
export type { WabaQueue } from '@/modules/julia-chat/pages/config/waba-templates/useWabaTemplates';
export { TemplateBuilderDialog } from '@/modules/julia-chat/pages/config/waba-templates/TemplateBuilderDialog';
export { HeaderTypesReferenceDialog } from '@/modules/julia-chat/pages/config/waba-templates/HeaderTypesReferenceDialog';
export { WhatsappPreview } from '@/modules/julia-chat/pages/config/waba-templates/WhatsappPreview';
export type {
  WabaStatus,
  WabaCategory,
  WabaTemplateRow,
  WabaTemplateComponent,
} from '@/modules/julia-chat/pages/config/waba-templates/types';
