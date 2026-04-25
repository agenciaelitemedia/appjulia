---
name: CRM Builder card link types (chat / Julia)
description: Cards do CRM Builder armazenam vínculos em custom_fields.links.{chat,julia}; criação via Sheet "Criar Card no CRM" no chat; DealCard exibe badges; DealDetailsSheet abre conversa ou CRMLeadDetailsDialog.
type: feature
---
Cards do CRM Builder (`crm_deals`) podem ter vínculos opcionais armazenados em `custom_fields.links`:

```json
{
  "source": "chat",
  "links": {
    "chat":  { "conversation_id": "...", "contact_phone": "...", "contact_name": "..." },
    "julia": { "card_id": 123, "whatsapp_number": "...", "cod_agent": "...", "stage_id": 4, "stage_name": "..." }
  }
}
```

- Criação a partir do chat: botão "Criar Card no CRM" no `ChatHeader` abre `CreateCrmCardSheet` (Sheet lateral). Lista quadros expansíveis → seleciona etapa → preenche título/valor/prioridade. Detecta automaticamente card Julia existente via `crm_atendimento_cards` (whatsapp_number + cod_agent) e oferece toggle de vínculo.
- Sem migration: `crm_deals.custom_fields jsonb` já existe.
- `DealCard` mostra badges `Chat` (azul) e `Julia #id` (roxo) quando vínculos presentes.
- `DealDetailsSheet` inclui `DealLinksSection` com botão "Abrir" (chat → `/chat` via sessionStorage `chat_pending_contact_id`) e "Ver" (Julia → `CRMLeadDetailsDialog`).
- Helpers: `getChatLink`, `getJuliaLink`, `useChatConversationPreview`, `useJuliaCardPreview` em `src/pages/crm-builder/hooks/useCardLinks.ts`.
- Também grava vínculo redundante em `chat_crm_links` (external_system='crm_builder').

**Sincronização Julia → card (badges, NÃO move no kanban):**
- `useJuliaCardPreview` faz refetch a cada 60s e expõe `stage_name`, `stage_color`, `business_name` ao vivo.
- `DealCard` mostra badges informativos: `Julia #id` + etapa atual da Julia (com cor original) + business_name. O kanban NÃO é alterado quando a etapa Julia muda — apenas os badges atualizam.

**Restrições para cards vinculados (chat ou Julia):**
- Não podem ser editados nem desvinculados.
- Menu do `DealCard` mostra apenas "Excluir card" (usa `archiveDeal`).
- `DealDetailsSheet` esconde o botão "Editar"; o botão de arquivar vira "Excluir card".
- Cards normais (sem vínculo) mantêm fluxo completo de edição/Ganho/Perdido/Arquivar.

**Resolução do `cod_agent` no `CreateCrmCardSheet`:**
Cadeia de fallback: prop `codAgent` (conversa) → `useQueueAgentLink(queueId)` (primary do queue_agent_links) → `useMyAgents().myAgents[0].cod_agent`. Badge no header indica a origem ("conversa", "via fila", "seu agente"). Só bloqueia se nenhuma das três fontes resolver.

**Acesso pelo header da conversa (`ChatHeader`):**
- Botão único `<ChatCrmButton />` substituiu o antigo botão IA (`AIAssistPanel` removido). Mesmo slot visual (`size="sm" variant="outline" gap-1.5`) com ícone Kanban + texto "CRM".
- Estado branco (outline) → conversa não vinculada → abre `CreateCrmCardSheet`.
- Estado azul preenchido (`bg-blue-50 text-blue-700 border-blue-300`) → conversa já vinculada a um deal → mostra também a etapa atual (ex.: `CRM · Qualificação`) e abre `ChatLinkedDealSheet`.
- `ChatLinkedDealSheet` permite mover o card entre etapas do mesmo board direto pelo chat (via `Select` → `UPDATE crm_deals.pipeline_id` + history `moved`), exibe vínculo Julia ao vivo (`useJuliaCardPreview`), e tem botão "Abrir no CRM" navegando para `/crm-builder/{boardId}?deal={dealId}`.
- O item "Criar Card no CRM" do menu MoreVertical foi removido — acesso exclusivo pelo botão.
- Detecção do vínculo via `useChatDealLink(conversationId, clientId)` que faz `contains('custom_fields', { links: { chat: { conversation_id } } })` em `crm_deals` (status != archived).

**Painel de chat lateral no CRM Builder Board:**
- `DealCard` exibe ícone WhatsApp verde (clicável, `MessageCircle`) ao lado do título quando há `chatLink`. Click chama prop `onOpenChat(deal)` repassada pelo `BoardPage` → abre `BoardChatSidePanel` à direita do kanban (largura 420/480px), empurrando o conteúdo (não é overlay).
- `BoardChatSidePanel` monta `WhatsAppDataProvider` isolado e renderiza `ChatHeader + ChatMessages + ChatInput` reaproveitando 100% o módulo `/chat`. `selectContact(contactId)` é chamado automaticamente no mount. `Esc` fecha o painel.
- `useDealConversation(deal)` resolve `conversation_id`, `contact_id`, `queue_id`, `queue_name`, `assigned_to`, `priority` e `status` da conversa vinculada.
- Badges sempre presentes no `DealCard` (substituíram o badge textual de prioridade): ícone `Flag` colorido por prioridade (cinza/azul/laranja/vermelho), badge de responsável (`assigned_to` ou "Não atribuído" cinza), e — apenas se vinculado — badge de fila com nome resolvido via `queues.name`.

**Sincronização bidirecional `assigned_to` + `priority` (DB triggers):**
- Coluna `crm_deals.assigned_to text` + índice GIN `idx_crm_deals_chat_link` em `(custom_fields->'links'->'chat')`.
- Funções `public.map_priority_chat_to_crm(text)` e `public.map_priority_crm_to_chat(text)` mapeiam `medium ↔ normal` (demais valores idênticos). Espelhadas em TS no `src/lib/crm/priorityMap.ts`.
- Triggers `trg_sync_deal_to_conversation` e `trg_sync_conversation_to_deal` propagam `assigned_to` e `priority` em ambas direções, com guarda `pg_trigger_depth() <= 1` para evitar loop.
- Backfill executado na migration: cards já vinculados herdam `assigned_to` e `priority` da conversa.
- Consequência: assumir conversa pelo chat atualiza o responsável do card; mudar prioridade no CRM Builder atualiza no chat.
