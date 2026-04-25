// Mapeamento bidirecional entre prioridades do CRM Builder (`crm_deals`)
// e do Chat (`chat_conversations`). Espelha as funções SQL
// `map_priority_chat_to_crm` e `map_priority_crm_to_chat`.

export type CrmPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ChatPriority = 'low' | 'normal' | 'high' | 'urgent';

export function chatToCrmPriority(p: string | null | undefined): CrmPriority {
  if (p === 'normal') return 'medium';
  if (p === 'low' || p === 'medium' || p === 'high' || p === 'urgent') return p;
  return 'medium';
}

export function crmToChatPriority(p: string | null | undefined): ChatPriority {
  if (p === 'medium') return 'normal';
  if (p === 'low' || p === 'high' || p === 'urgent') return p;
  return 'normal';
}