/**
 * Metadados do módulo Flow Builder (Automações).
 *
 * Fonte única de verdade para code de permissão, rotas, ícone e menu.
 * Qualquer integração externa (App.tsx, sidebar, permissões) deve ler daqui.
 */
export const FLOW_BUILDER_MODULE = {
  code: 'flow_builder',
  name: 'Automações',
  description: 'Editor visual de automações para Chat, CRM e Julia (IA)',
  icon: 'Workflow',
  route: '/automacoes',
  menuGroup: 'SISTEMA',
  category: 'sistema',
  displayOrder: 92,
} as const;

export const FLOW_BUILDER_ROUTES = {
  list: '/automacoes',
  editor: (flowId: string) => `/automacoes/${flowId}`,
  editorPattern: '/automacoes/:flowId',
} as const;