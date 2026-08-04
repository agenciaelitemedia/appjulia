/**
 * Metadados do módulo Escritórios (clientes sem agente da Julia).
 *
 * Fonte única de verdade para codes de permissão, rotas, ícones e menu.
 * Qualquer integração externa (App.tsx, sidebar, permissões) deve ler daqui.
 */
export const ESCRITORIOS_MODULE = {
  code: 'escritorios',
  name: 'Escritórios',
  description: 'Cadastro e liberação de escritórios que operam sem agente da Julia',
  icon: 'Building2',
  route: '/escritorios',
  menuGroup: 'ADMIN',
  category: 'admin',
  displayOrder: 93,
} as const;

/** Dashboard de atendimento (rota própria dos escritórios, sem dados de agente/IA). */
export const OFFICE_DASHBOARD_MODULE = {
  code: 'painel_atendimento',
  name: 'Painel de Atendimento',
  description: 'Indicadores de chat e atendimentos do escritório',
  icon: 'LayoutDashboard',
  route: '/painel-atendimento',
  menuGroup: 'PRINCIPAL',
  category: 'principal',
  displayOrder: 1,
} as const;

export const ESCRITORIOS_ROUTES = {
  list: '/escritorios',
  create: '/escritorios/novo',
  details: (id: string) => `/escritorios/${id}`,
  detailsPattern: '/escritorios/:officeId',
  dashboard: '/painel-atendimento',
} as const;

/**
 * Pacote de módulos liberado automaticamente para um escritório.
 * Marcados como sugeridos no wizard, podendo ser editados via checkbox.
 */
export const OFFICE_MODULE_PACKAGE: { code: string; label: string }[] = [
  { code: 'painel_atendimento', label: 'Painel de Atendimento' },
  { code: 'chat', label: 'Chat / Atendimento' },
  { code: 'crm_painel', label: 'Painel CRM' },
  { code: 'filas', label: 'Filas' },
  { code: 'wavoip', label: 'ZAP Call' },
  { code: 'telephony', label: 'VoIP Call' },
  { code: 'team', label: 'Equipe' },
  { code: 'quick_messages', label: 'Mensagens Rápidas' },
  { code: 'notify_customers', label: 'Notificação Interna' },
  { code: 'help_center', label: 'Central de Ajuda' },
  { code: 'flow_builder', label: 'Automações' },
  { code: 'contacts', label: 'Contatos' },
];

export const OFFICE_MODULE_CODES = OFFICE_MODULE_PACKAGE.map((m) => m.code);