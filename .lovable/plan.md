## Objetivo

Ao clicar em "Abrir" no card do CRM (`DealLinksSection`) ou no botão externo do `ChatSidePanel`, a página `/chat` deve:

1. Preencher o campo **Buscar atendimento** com o telefone do lead (dígitos-only, canônico BR).
2. Ativar a **aba correta** onde a conversa se encontra (Aguardando / Meus Atendimentos / Resolvidas·Encerradas), calculada a partir do `status` real + `assigned_to`.
3. **Selecionar** o contato-alvo (mensagens já aparecem no painel central), mesmo que o filtro por telefone/variação BR não o encontre na lista.

## Diagnóstico

O fluxo atual (feito nas fases anteriores) já grava `search`, `tab`, `contactId` no `sessionStorage` e o `ChatPage` reidrata tudo. Dois pontos ainda quebram a UX:

- **Search zerava a lista** — por isso o `ChatSidePanel` explicitamente **não** enviava `search` (comentário nas linhas 136-139). O filtro local em `ChatList` (linhas 763-766 e 853-858) compara `contact.phone.includes(q)` sem normalizar dígitos nem considerar variantes BR com/sem 9º dígito. Um telefone `5551997803374` não casa com um `contact.phone` gravado como `555197803374` (12 díg).
- **Aba errada** — quando a query de `chat_conversations` do `ChatPage` retorna `status = pending` mas com `assigned_to`, a helper `conversationStatusToPendingTab` já resolve para `open`. Se ainda estiver caindo na aba errada, é porque o `search` estava zerado e a lista não mostrava o registro; o usuário via a aba padrão (`open`) sem o lead e interpretava como "aba errada".

## Alterações

### 1. `src/components/chat/ChatList.tsx` — filtro local tolerante a telefone BR

- Importar `getBrPhoneVariants` (já usado no server-search).
- No `baseForCounts` (linhas 760-770), no bloco de totalizadores (linhas 854-858) e no `visibleContacts` (mesma lógica de search por `q`), substituir o `phone.includes(q)` por: se `q` contém 8+ dígitos, comparar `contact.phone.replace(/\D/g,'')` contra **qualquer** variante de `getBrPhoneVariants(q)` via `startsWith`/`includes`. Manter o match por `name` intacto.
- Efeito: qualquer variação de 12 ou 13 dígitos casa com o contato armazenado, sem regredir buscas por nome.

### 2. `src/pages/crm-builder/components/deals/DealLinksSection.tsx`

- Ao montar o `setPendingSelection`, passar `search: normalizeBrPhone(deal.contact_phone ?? chat?.contact_phone)` (dígitos-only, canônico BR 13 díg) — hoje envia o telefone bruto/formatado.

### 3. `src/components/chat/ChatSidePanel.tsx` — botão "Abrir no Chat" (linha 111)

- Remover o comentário/decisão "NÃO passar search" e passar `search: normalizeBrPhone(...)` a partir do telefone do contato-alvo (buscar `chat_contacts.phone` na mesma query já feita ou trazer do `dealContact` do `ScopedChat` via prop, sem novo round-trip pesado).

### 4. `src/pages/chat/ChatPage.tsx` — sem mudança estrutural

- Continua consumindo `pending`, aplicando fila, status→aba via `conversationStatusToPendingTab(status, assigned_to)`, `setSearchQuery(pending.search)` e `selectContact(pending.contactId)`.
- **Reforço:** garantir a ordem `setConversationStatusFilter → setSearchQuery → selectContact` já executada dentro do mesmo tick (já é o caso).

## Detalhes técnicos

- Normalização única de origem: `normalizeBrPhone` (`src/lib/phoneNormalize.ts`) — 13 díg canônico. Já existe helper Deno paralelo, não precisamos tocar.
- Casamento tolerante: `getBrPhoneVariants` (`src/lib/phoneVariants.ts`) devolve as duas formas (com/sem 9º díg). Usar em ChatList local para paridade com o server-search.
- `selectContact(id)` já hidrata contato por UUID mesmo se estiver fora do cache visível — então, mesmo em cenário-limite (filtro esconde o lead), o painel central mostra as mensagens e o usuário enxerga a aba correta com o registro selecionado.
- Escopo estritamente frontend/presentation — nenhuma tabela, RLS, edge-function ou migração é tocada.

## Verificação

- Typecheck após as três edições.
- Teste manual do caso `5551997803374`: abrir do CRM Builder e do `ChatSidePanel` (Chat da Julia/Contratos) e conferir campo Buscar preenchido, aba pending/open/resolved coerente com o status atual da conversa e mensagens do lead visíveis.
