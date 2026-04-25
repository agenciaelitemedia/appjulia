
# Integração profunda CRM Builder ↔ Chat

## Objetivo

Quando um deal do CRM Builder estiver vinculado a uma conversa do chat (`custom_fields.links.chat.conversation_id`), o usuário deve:

1. Ver no `DealCard` um **ícone de WhatsApp** clicável.
2. Ao clicar, abrir um **painel lateral à direita do board** com a conversa completa (mesmas regras do `/chat`: assumir, enviar, responder, fechar).
3. Ter **responsável**, **prioridade** e **fila** sincronizados entre o card e a conversa — mudou em um, muda no outro.
4. Sempre ver no card os badges de **responsável** (ou "Não atribuído"), **fila** (se vinculado) e **ícone de prioridade** (sempre presente).

## 1. Sincronização de dados — a regra central

### 1.1 Campo `assigned_to` (responsável)

- **Verdade**: o card e a conversa devem ter o mesmo `assigned_to` quando vinculados.
- Adicionar coluna `assigned_to text` em `crm_deals` (já existe no tipo TS, **conferir migration**; se faltar criar).
- Adicionar trigger SQL `crm_deals_sync_to_conversation`: ao `UPDATE` de `assigned_to` ou `priority` em `crm_deals`, se `custom_fields->'links'->'chat'->>'conversation_id'` existir, replicar para `chat_conversations`.
- Adicionar trigger inverso `chat_conversations_sync_to_deal`: ao `UPDATE` de `assigned_to` ou `priority` em `chat_conversations`, encontrar o deal vinculado (índice GIN em `custom_fields`) e replicar.
- Os triggers usam `pg_trigger_depth() < 1` para evitar loop infinito.
- Índice: `CREATE INDEX IF NOT EXISTS idx_crm_deals_chat_link ON crm_deals USING GIN ((custom_fields->'links'->'chat'));`

### 1.2 Mapeamento de prioridade

Divergência atual:
- `crm_deals.priority`: `low | medium | high | urgent`
- `chat_conversations.priority`: `low | normal | high | urgent`

Mapeamento bidirecional (constantes em `src/lib/crm/priorityMap.ts`):
- `medium` ↔ `normal` (única tradução; `low/high/urgent` são iguais).
- Trigger SQL e helper TS aplicam a mesma tabela.

### 1.3 Fila (`queue_id`)

- A fila é propriedade da conversa — **não é editável a partir do card**, apenas exibida.
- Quando o card é criado vinculado, gravamos um snapshot em `custom_fields.links.chat.queue_id` para exibir o nome da fila offline. Atualizado pelo trigger sempre que a conversa muda de fila (raro).

## 2. Backend — migration única

Arquivo: nova migration via tool de DB (não preciso decidir o nome). Conteúdo:

1. `ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS assigned_to text;`
2. Índice GIN em `crm_deals(custom_fields)` — restringir a `(custom_fields->'links'->'chat')` se possível.
3. Função `public.map_priority_chat_to_crm(text) returns text` e inversa.
4. Função trigger `sync_deal_to_conversation()` — aplica `assigned_to` direto e prioridade traduzida; só dispara se houver `conversation_id`.
5. Função trigger `sync_conversation_to_deal()` — busca o deal pelo `custom_fields` e atualiza.
6. Triggers `AFTER UPDATE OF assigned_to, priority` em ambas as tabelas, com guarda `pg_trigger_depth() = 0`.
7. Backfill simples: `UPDATE crm_deals d SET assigned_to = c.assigned_to, priority = map_priority_chat_to_crm(c.priority) FROM chat_conversations c WHERE (d.custom_fields->'links'->'chat'->>'conversation_id')::uuid = c.id AND d.assigned_to IS NULL;`

## 3. Frontend — painel lateral no Board

### 3.1 Novo componente `BoardChatSidePanel.tsx` (em `src/pages/crm-builder/components/deals/`)

Estrutura:
- Drawer fixo à direita do board (não usa `Sheet` overlay — é uma **coluna inline** que empurra o conteúdo para preservar o kanban visível). Largura: `w-[420px] xl:w-[480px]`, com botão de fechar e expandir/colapsar.
- Recebe `dealId`, `conversationId`, `contact` (resolvido via hook abaixo).
- Composição:
  - Reusa **`ChatHeader`** (compacto via prop `compact`) — exibe assumir, status, prioridade, fila.
  - Reusa **`ChatMessages`** + **`ChatInput`** exatamente como no `/chat`.
- Para isso, precisa empacotar com **`WhatsAppDataProvider`** local, **OU** (preferido) refatorar minimamente `ChatMessages`/`ChatInput`/`ChatHeader` para aceitarem `contactId`/`conversationId` por prop e desacoplar do `useWhatsAppData()`. **Decisão**: criar um wrapper `ScopedChatProvider` que monta um `WhatsAppDataContext` isolado focado num único contato/conversa, evitando refator profundo dos componentes existentes. Isso preserva o módulo `/chat` intacto.

### 3.2 Hook `useDealConversation(deal)` em `src/pages/crm-builder/hooks/`

- Lê `getChatLink(deal)` → `conversation_id`.
- Busca `chat_conversations` + `chat_contacts` correspondente.
- Retorna `{ conversationId, contact, contactId, isLoading }`.
- Usado pelo painel para alimentar o `ScopedChatProvider`.

### 3.3 Integração no `BoardPage.tsx`

- Estado `chatPanelDeal: CRMDeal | null`.
- Layout passa a ser `flex`: kanban à esquerda (`flex-1`), painel à direita quando aberto.
- Persistência: salva `chatPanelDeal?.id` em `localStorage('crm-builder:chat-panel')` para reabrir após refresh.
- Tecla `Esc` fecha o painel.

## 4. Frontend — DealCard

### 4.1 Ícone WhatsApp clicável

- Em `DealCard.tsx`, no header (ao lado do título), adicionar botão verde `WhatsApp` (lucide `MessageCircle` com fill verde, ou ícone customizado `wa-icon`) **somente se** `chatLink` existir.
- `onClick` (com `e.stopPropagation()`) chama nova prop `onOpenChat(deal)` que sobe até o `BoardPage` e abre o painel.
- Tooltip: "Abrir conversa".
- Substitui visualmente o badge "Chat" atual ou complementa — **decisão**: manter badge "Chat" no rodapé para consistência, mas o ícone vira o **ponto de ação principal**.

### 4.2 Novos badges obrigatórios no card

Bloco novo abaixo das datas, sempre presente (mesmo sem vínculo):

- **Prioridade** (sempre): ícone `Flag` ou `AlertTriangle` colorido conforme `PRIORITY_CONFIG` (`low`=cinza, `medium`=azul, `high`=laranja, `urgent`=vermelho). **Substitui** o badge textual atual de prioridade — texto vira tooltip. Mais visual, menos poluído.
- **Responsável** (sempre): avatar circular pequeno + primeiro nome, ou chip "Não atribuído" cinza-claro quando `assigned_to` é null. Usa `assigned_to` do deal.
- **Fila** (apenas se vinculado): chip pequeno com ícone `Inbox` + nome da fila resolvido via `chat_queues.name` (cache no hook `useChatQueues`).

Reorganização do footer do card:
```
[título]                    [📱 wa] [⋮ menu]
[💰 valor]
[👤 contato] [📞 telefone]
[criado / atualizado]
[🚩 prioridade] [👤 responsável] [📥 fila?] [tags...]
[Chat 🔵] [Julia 🟣]   ⏱ tempo na fase
```

## 5. ChatHeader — exibir prioridade e fila lá também

Hoje o `ChatHeader` mostra status, SLA, tags. Acrescentar (já que o usuário quer "parecido com o chat"):
- Badge **Prioridade** clicável → popover com 4 opções (`low/normal/high/urgent`) — atualiza `chat_conversations.priority` (e via trigger, o deal).
- Badge **Fila** somente leitura (já existe via `ChannelBadge` parcialmente).
- Badge **Responsável** já existe via `ConversationParticipants`/botão "Assumir" — manter.

## 6. Regras de negócio reaproveitadas

- **"Assumir conversa"** (ChatHeader) — funciona inalterado dentro do painel; quando o usuário assume, o trigger sincroniza `assigned_to` no deal.
- **CRM Builder permissions** (memory `builder-permissions`) — somente admin gerencia estrutura; envio de mensagens/assumir respeita permissões já existentes do `/chat`.
- **Cards vinculados não editáveis** continua válido — o painel não dá acesso a editar `title`/`value`/`pipeline` (isso continua sendo via "Mover etapa" no `ChatLinkedDealSheet` do chat ou via CRM Builder direto).

## 7. Memória a atualizar

`mem/features/crm/builder-card-link-types.md` — adicionar:
- Painel de chat lateral no board (`BoardChatSidePanel`).
- Sincronização bidirecional `assigned_to` + `priority` via triggers SQL.
- Tabela de mapeamento `medium ↔ normal`.
- Badges obrigatórios: prioridade (sempre), responsável (sempre), fila (se vinculado).

## 8. Riscos e decisões

- **Loop de triggers**: mitigado por `pg_trigger_depth() = 0`.
- **Refator do contexto de chat**: optei por `ScopedChatProvider` em vez de refatorar `ChatMessages/Input/Header` para evitar regressão no `/chat` principal. Custo: duplica brevemente o provider, mas isolado.
- **Largura do board**: o painel reduz espaço horizontal do kanban. Mitigação: botão de colapsar para `w-12` mostrando só ícone de notificação de novas mensagens.
- **Performance**: índice GIN em `custom_fields` evita scan completo no trigger inverso.

## 9. Itens fora do escopo

- Realocar fila do card pelo CRM (a fila é gerenciada no chat).
- Sincronizar tags entre conversa e deal (pode ser próximo passo).
- Permitir abrir painel para deals **sem** vínculo (sem chat = sem painel).
