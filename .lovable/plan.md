# Reaproveitar o painel de chat do CRM Builder na Jul.IA (CRM e Contratos)

## O que muda

Hoje o chat lateral do CRM Builder vive em `BoardChatSidePanel` e está acoplado ao tipo `CRMDeal` + ao hook `useDealConversation` (que depende do link `custom_fields.links.chat.conversation_id`). Vamos quebrar esse painel em um **componente reusável genérico** e usar esse mesmo componente em dois novos pontos:

1. **CRM da Jul.IA** (`CRMLeadCard.tsx`): o botão verde de WhatsApp, quando o `cod_agent` do card está vinculado a uma fila (via `queue_agent_links`), passa a abrir o painel reusável em vez do `WhatsAppMessagesDialog` (que conversa direto com a UaZapi).
2. **Contratos da Jul.IA** (`ContratosTable.tsx`): mesma regra — botão verde de WhatsApp abre o painel reusável quando o agente do contrato tem fila vinculada.

Quando o agente **não** tem fila vinculada (modo `direct`, conexão UaZapi do próprio agente), o comportamento atual é mantido (abre o `WhatsAppMessagesDialog` antigo). Sem regressão para clientes legados.

## Como vai funcionar

### 1. Extrair o componente reusável

Novo arquivo `src/components/chat/ChatSidePanel.tsx` contendo a UI hoje dentro de `BoardChatSidePanel` + `ScopedChat`, mas com props **agnósticas de domínio**:

```ts
interface ChatSidePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Identificadores resolvidos da conversa-alvo */
  target: {
    contactId: string | null;
    queueId: string | null;
    conversationId: string | null;
  } | null;
  /** Estados externos para mostrar skeleton/erro sem precisar refazer fetch */
  isLoading?: boolean;
  /** Texto opcional para o cabeçalho ("Conversa do card" / "Conversa do lead") */
  title?: string;
}
```

Internamente o componente continua:
- Validando acesso à fila (`useUserQueueAccess`).
- Buscando a `queues` row para hidratar `SelectedQueue`.
- Montando `WhatsAppDataProvider` isolado + `ScopedChat` (mantendo header/mensagens/input + tratamento de erro/timeout/skeleton).
- Botão "Abrir no Chat" no header usa `setPendingSelection` + `navigate('/chat')`.

`BoardChatSidePanel` vira um **wrapper fininho** que usa `useDealConversation(deal)` para montar o `target` e delega tudo para `<ChatSidePanel ... />`. Zero regressão no Builder.

### 2. Resolver o `target` na Jul.IA

Novo hook `src/hooks/useAgentChatTarget.ts`:

```ts
useAgentChatTarget(codAgent: string | null, whatsapp: string | null)
  → { isLinked: boolean; target: ChatSidePanelTarget | null; isLoading: boolean }
```

Passos da query (`useQuery`, `staleTime 30s`):
1. Reusa a lógica do `useAgentQueueLink` para descobrir a fila ativa do `cod_agent`. Se `source !== 'queue'` → `{ isLinked: false }`.
2. Normaliza o telefone (somente dígitos) com utilitários de `src/lib/phoneNormalize.ts`.
3. Acha `chat_contacts.id` por `phone` no mesmo `client_id` da fila.
4. Se achar contato, busca a `chat_conversations` mais recente onde `queue_id = X` e `contact_id = Y` (ignora `is_deleted=true`).
5. Retorna `{ isLinked: true, target: { contactId, queueId, conversationId? } }`. Se não achar contato/conversa, devolve `target=null` para que a UI faça fallback ao dialog antigo.

### 3. Pontos de uso

**`src/pages/crm/components/CRMLeadCard.tsx`**
- Adiciona `const { isLinked, target } = useAgentChatTarget(card.cod_agent, card.whatsapp_number);`
- `handleWhatsApp` decide:
  - `isLinked && target` → `setSidePanelOpen(true)`
  - caso contrário → `setMessagesOpen(true)` (comportamento atual)
- Renderiza `<ChatSidePanel open={sidePanelOpen} onOpenChange={setSidePanelOpen} target={target} title="Conversa do lead" />` ao lado do `WhatsAppMessagesDialog` existente.

**`src/pages/estrategico/contratos/components/ContratosTable.tsx`**
- Cria componente interno `ContratoChatTrigger` (uma linha por row) responsável por chamar `useAgentChatTarget` e renderizar o botão + painel — evita poluir a tabela e garante que cada linha tenha seu próprio estado.
- Mantém `WhatsAppMessagesDialog` existente como fallback.

**Não mexer** em `DesempenhoTable.tsx`, `CampanhasLeadsTab.tsx`, `CRMLeadDetailsDialog.tsx`, schema, RLS ou Edge Functions (pedido cobre apenas CRM Júlia + Contratos).

## Critérios de aceite

- Builder continua funcionando exatamente como hoje (mesmo painel, mesmo "Abrir no Chat").
- Card do CRM Júlia com agente vinculado a fila: clicar no botão verde abre o painel lateral idêntico ao do Builder, com a conversa carregada.
- Linha de Contratos com agente vinculado a fila: idem.
- Card/contrato com agente **sem** fila vinculada: continua abrindo o `WhatsAppMessagesDialog` antigo.
- Telefone não encontrado em nenhuma conversa da fila: fallback para o dialog antigo (evita painel vazio).

## Fora de escopo

- Mudanças no `WhatsAppMessagesDialog`.
- Mudanças no `/chat` ou no `pendingSelection`.
- Backend (Edge Functions, RLS, schema).
