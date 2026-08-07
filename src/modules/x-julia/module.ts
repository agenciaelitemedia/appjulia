/**
 * Metadados do módulo X-Julia (Extreme Julia).
 *
 * Módulo 100% independente: nada fora de src/modules/x-julia importa daqui,
 * e tudo que vem de outros módulos passa por src/modules/x-julia/extend.
 */
export const X_JULIA_MODULE = {
  code: 'x_julia',
  name: 'X-Julia',
  description: 'Agente jurídico autônomo: recepção, triagem, qualificação, contrato e agenda',
  icon: 'Sparkles',
  route: '/x-julia',
  menuGroup: 'INTELIGÊNCIA',
  category: 'admin',
  displayOrder: 40,
} as const;

export const X_JULIA_ROUTES = {
  dashboard: '/x-julia',
  agents: '/x-julia/agentes',
  agent: (id: string) => `/x-julia/agentes/${id}`,
  agentPattern: '/x-julia/agentes/:agentId',
  cases: '/x-julia/casos',
  crm: '/x-julia/crm',
  sessions: '/x-julia/atendimentos',
  session: (id: string) => `/x-julia/atendimentos/${id}`,
  sessionPattern: '/x-julia/atendimentos/:sessionId',
  contracts: '/x-julia/contratos',
  agenda: '/x-julia/agenda',
  contractSign: '/x-julia/contrato/:contractId',
} as const;

/** Estágios do atendimento conduzido pelo agente. */
export const XJ_STAGES = [
  'recepcao',
  'triagem',
  'qualificacao',
  'negociacao',
  'contrato',
  'assinatura',
  'agendamento',
  'humano',
  'encerrado',
] as const;

export type XJStage = (typeof XJ_STAGES)[number];

export const XJ_STAGE_LABELS: Record<XJStage, string> = {
  recepcao: 'Recepção',
  triagem: 'Triagem',
  qualificacao: 'Qualificação',
  negociacao: 'Negociação',
  contrato: 'Contrato',
  assinatura: 'Assinatura',
  agendamento: 'Agendamento',
  humano: 'Atendimento humano',
  encerrado: 'Encerrado',
};

export const XJ_STAGE_COLORS: Record<XJStage, string> = {
  recepcao: 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
  triagem: 'bg-sky-500/15 text-sky-600 dark:text-sky-300',
  qualificacao: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300',
  negociacao: 'bg-purple-500/15 text-purple-600 dark:text-purple-300',
  contrato: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
  assinatura: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
  agendamento: 'bg-teal-500/15 text-teal-600 dark:text-teal-300',
  humano: 'bg-orange-500/15 text-orange-600 dark:text-orange-300',
  encerrado: 'bg-rose-500/15 text-rose-600 dark:text-rose-300',
};

/** Provedores de LLM suportados pelo módulo (espelha supabase/functions/_shared/x-julia/llm.ts). */
export const XJ_LLM_PROVIDERS: Array<{ id: string; label: string; models: string[]; needsKey: boolean }> = [
  {
    id: 'lovable',
    label: 'Lovable AI (sem chave)',
    needsKey: false,
    models: [
      'google/gemini-3.6-flash',
      'google/gemini-3.1-pro-preview',
      'google/gemini-3.1-flash-lite',
      'openai/gpt-5.6-terra',
      'openai/gpt-5.6-luna',
      'openai/gpt-5.5',
    ],
  },
  { id: 'openai', label: 'OpenAI', needsKey: true, models: ['gpt-4.1', 'gpt-4o', 'gpt-4o-mini'] },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    needsKey: true,
    models: ['anthropic/claude-sonnet-4', 'openai/gpt-4.1', 'google/gemini-2.5-pro', 'deepseek/deepseek-chat'],
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    needsKey: true,
    models: ['claude-sonnet-4-20250514', 'claude-3-7-sonnet-latest', 'claude-3-5-haiku-latest'],
  },
  { id: 'deepseek', label: 'DeepSeek', needsKey: true, models: ['deepseek-chat', 'deepseek-reasoner'] },
  { id: 'grok', label: 'Grok (xAI)', needsKey: true, models: ['grok-4', 'grok-3', 'grok-3-mini'] },
  { id: 'gemini', label: 'Google Gemini (direto)', needsKey: true, models: ['gemini-2.5-pro', 'gemini-2.5-flash'] },
  { id: 'llmapi', label: 'LLM API', needsKey: true, models: ['gpt-4o', 'claude-3-5-sonnet', 'llama3.1-70b'] },
];

export const XJ_VOICE_PROVIDERS = [
  { id: 'elevenlabs', label: 'ElevenLabs' },
  { id: 'voicemaker', label: 'Voicemaker' },
];

export const XJ_CONTRACT_PROVIDERS = [
  { id: 'internal', label: 'Assinatura interna (X-Julia)' },
  { id: 'zapsign', label: 'ZapSign' },
];

export const XJ_FOLLOWUP_CONTENT_TYPES = [
  { id: 'text', label: 'Texto' },
  { id: 'audio', label: 'Áudio' },
  { id: 'image', label: 'Imagem' },
  { id: 'video', label: 'Vídeo' },
  { id: 'document', label: 'Documento' },
  { id: 'link', label: 'Link' },
];