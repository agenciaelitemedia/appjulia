# Plano de implementação — CRM Builder: Telefone, Contatos e Vínculo Júlia/Chat

Vou dividir em **3 frentes independentes** que podem ser entregues em sequência sem quebrar o que já funciona. Cada frente é incremental e isolada.

---

## 🧭 Mapeamento atual (para garantir compatibilidade)

- **Card visual**: `src/pages/crm-builder/components/deals/DealCard.tsx` — já tem barra de ações superior (chat + menu) e badges (`Chat`, `Julia #id`, fila).
- **Vínculos**: `useCardLinks.ts` lê `custom_fields.links.chat` e `custom_fields.links.julia`.
- **Conversa do card**: `useDealConversation.ts` resolve `conversationId → contact_id, queue_id, queueName`.
- **Telefonia padrão Júlia**: `usePhone()` (`PhoneContext`) + `<PhoneCallDialog whatsappNumber codAgent contactName />` (já usado em `ComercialLeadCard` e `ChatHeader`).
- **Popup atual de criação manual**: `CreateDealDialog.tsx` (campos nome/telefone/email soltos) — será reformado.
- **Popup do chat → CRM**: `CreateCrmCardSheet.tsx` (já funciona, será mantido como está).
- **Diálogo "Conversar"**: `NewConversationDialog.tsx` aceita `initialPhone`; precisa aceitar `initialName` + `lockContact`.
- **Tabela de contatos**: `chat_contacts` (`client_id, phone, name, lead_email, channel_source, ...`) — única fonte para autocomplete.
- **Identidade Júlia no card**: hoje, badge `Julia #id` aparece **somente** quando existe `links.julia`. A regra nova será: card Júlia = card cuja **fila vinculada** está atrelada a um agente da Júlia (via `useQueueAgentLink`).

---

## 🎯 Frente 1 — Botão de telefone no card (rápido, isolado)

**Arquivo:** `src/pages/crm-builder/components/deals/DealCard.tsx`

Acrescentar, **antes** do botão de chat (linha ~165), um botão idêntico ao do `ComercialLeadCard`:

- Renderiza só se `deal.contact_phone` existir **e** `usePhone().isAvailable === true`.
- Visual: `Button variant="outline" size="icon" h-7 w-7 rounded-full text-orange-500 border-orange-500/30` com ícone `Phone`.
- Ao clicar (com `stopPropagation` + `onPointerDown` para não disparar drag): abre `<PhoneCallDialog whatsappNumber={deal.contact_phone} contactName={deal.contact_name||deal.title} codAgent={deal.cod_agent||''} />`.
- Estado local `phoneCallOpen` igual ao do Comercial.

Sem mudanças em hook, schema, ou outros componentes.

---

## 🎯 Frente 2 — Novo popup de criação manual com busca/cadastro de contato

### 2.1 Novo componente `ContactPicker` (reutilizável)

**Arquivo novo:** `src/pages/crm-builder/components/deals/ContactPicker.tsx`

Inspirado no "Selecionar Cliente" (imagem anexada). Estrutura:

- **Cabeçalho:** título "Selecionar Contato" + subtítulo.
- **Linha de busca** (Input com ícone `Search` + botão `[X]` para limpar) e **botão `Novo Contato`** ao lado direito.
- **Lista de resultados** (max-h ~280px, scroll interno):
  - Query: `chat_contacts` filtrado por `client_id`, com `or(name.ilike.%q%, phone.ilike.%q%, lead_email.ilike.%q%)`, limit 20, debounce 250ms.
  - Mostra avatar (placeholder Building2/User), `name` em destaque, e `phone · email` como subtítulo, chevron `>` à direita.
  - Estados: loading skeleton, "Nenhum contato encontrado", contagem "X contato(s) encontrado(s)".
- **Modo "Novo Contato"** (toggla a área inferior; busca permanece visível):
  - **Nome** (obrigatório).
  - **Telefone**: dois campos lado a lado — `Select DDI` (default `+55`, opções comuns: BR 55, US 1, PT 351, ES 34, AR 54) + `Input` com máscara BR `(99) 99999-9999`. Validar mínimo 8 dígitos no número (sem o DDI).
  - **Email** (opcional, validar formato).
  - **Validação anti-duplicação on blur** (telefone normalizado `ddi+digits`, ou email exato):
    - Faz `select` em `chat_contacts` por `phone == normalized` ou `lead_email ilike email`.
    - Se telefone duplicado → **bloqueia** o salvar e mostra alerta (`Alert` âmbar) com card do contato existente + botão `Usar este contato` (apenas seleção, sem salvar).
    - Se apenas email duplicado → mostra alerta, mas oferece **dois botões**: `Usar contato existente` ou `Continuar e salvar mesmo assim`.
  - Botões: `Cancelar` (volta para busca) e `Salvar contato` (insere em `chat_contacts` com `client_id`, `cod_agent` herdado do board, `phone` = só dígitos `ddi+numero`, `name`, `lead_email`, `channel_type='whatsapp_uazapi'`).
- **Saída do componente**: `onSelect({ id, name, phone, email })`.

### 2.2 Refatoração do `CreateDealDialog.tsx`

- **Aumentar largura**: `sm:max-w-2xl` (em vez de `sm:max-w-lg`).
- **Remover scroll interno**: trocar `max-h-[60vh] overflow-y-auto` por `max-h-[75vh] overflow-y-auto` apenas se houver custom fields; reorganizar grid para reduzir altura.
- **Remover** os 3 campos `contactName/contactPhone/contactEmail`.
- **Substituir** pelo `<ContactPicker selectedContact={contact} onSelect={setContact} />`.
- Quando `contact` é selecionado, mostra um "card de contato selecionado" compacto (avatar + nome + telefone + botão "Trocar").
- No `onSubmit`, popular `contact_name`, `contact_phone`, `contact_email` a partir do `contact` selecionado.

### 2.3 Detecção automática "card vinculado ao chat"

Após selecionar o contato, executar **uma query**:

```ts
// useContactConversation(contactId)
supabase.from('chat_conversations')
  .select('id, status, queue_id')
  .eq('client_id', clientId)
  .eq('contact_id', contactId)
  .in('status', ['pending','open','closed'])
  .order('updated_at', { ascending: false })
  .limit(1)
  .maybeSingle()
```

- **Se existe conversa** → exibe um banner `Vínculo automático: este contato já tem conversa no chat (#protocolo · status)`. Ao criar o card, popular `custom_fields.links.chat = { conversation_id, contact_phone, contact_name }`. **Esse caminho fica idêntico ao card criado a partir do chat** (frente 3 vai detectar Júlia automaticamente pela fila).
- **Se não existe conversa** → card sem `links.chat` (igual hoje). O ícone WhatsApp **amarelo** (frente 3) cuidará da iniciação.

**Sem alteração de schema.** Apenas inserts em `chat_contacts` (já permitido) e leitura.

---

## 🎯 Frente 3 — Card vinculado: ícone WhatsApp amarelo, badge Jul.IA roxo, painel detalhado

### 3.1 Hook novo: `useDealJuliaContext`

**Arquivo novo:** `src/pages/crm-builder/hooks/useDealJuliaContext.ts`

Para um deal:
1. Resolve a fila do deal (via `useDealConversation`, ou via `cod_agent` direto se não há chat).
2. Usa `useQueueAgentLink(queueId)` para descobrir se a fila está atrelada a um agente Júlia → retorna `{ isJulia, codAgent, agentAlias }`.
3. Busca o card Júlia correspondente em `crm_atendimento_cards` por `(whatsapp_number = normalizePhone(deal.contact_phone), cod_agent)` (já existe lógica equivalente em `CreateCrmCardSheet`). Retorna `{ juliaCard: { id, stage_id, stage_name, stage_color, business_name, agent_status_color } }`.
4. Busca contrato (se existir) — query existente do módulo Júlia (verificarei `useContractByPhone` ou similar; se não existir, query simples em `contracts` por `whatsapp_number`).

Cache 30s, sem realtime.

### 3.2 Hook novo: `useChatContactConversationStatus`

Para o `contact_phone` do card sem `links.chat`, verifica se já existe contato + conversa em `chat_contacts/chat_conversations` para decidir se o ícone WhatsApp aparece **verde** (conversa ativa) ou **amarelo** (contato sem conversa, precisa iniciar).

### 3.3 Atualização do `DealCard.tsx`

**Ícone WhatsApp (verde/amarelo):**
- Hoje só renderiza `MessageCircle` verde se `chatLink` existir.
- Nova regra:
  - `chatLink` presente → **verde** (como hoje), `onClick` abre o `BoardChatSidePanel`.
  - `chatLink` ausente mas `contact_phone` existe → **amarelo** (`text-amber-500 border-amber-500/30`), `onClick` abre `NewConversationDialog` (frente 3.4) pré-preenchido e travado.

**Badge "Chat" → "Jul.IA" quando aplicável:**
- Se `juliaContext.isJulia === true`, troca o badge azul `[Chat]` por badge roxo `[Jul.IA]` (`bg-purple-500/10 text-purple-700 border-purple-500/30`, ícone `Scale` ou `Sparkles`).
- **Continua mostrando** o badge da fila ao lado, sem mudança.
- Se `isJulia === false`, mantém `[Chat]` azul como hoje.

**Badge do agente (cod_agent + alias):**
- Quando `isJulia` e tiver `codAgent + alias`, adicionar um badge `#{codAgent} - {alias}` ao lado do badge de responsável (linha de status). Estilo idêntico ao usado nos cards do CRM Júlia.

### 3.4 `NewConversationDialog` — modo "lock"

- Adicionar props opcionais: `initialName?: string`, `lockContact?: boolean`.
- Quando `lockContact=true`: campos `phone` e `name` ficam `readOnly` + visualmente "lockados" (cinza, ícone de cadeado pequeno).
- Após `handleSend` bem-sucedido, expor um callback `onConversationStarted?: ({ phone }) => void` para que o caller (DealCard) possa fazer `update` no deal e gravar `custom_fields.links.chat = { conversation_id: null, contact_phone, contact_name }`. O `conversation_id` real é resolvido depois via realtime/refetch do `useDealConversation`, mas o badge `Chat` já aparece imediatamente.
  - **Alternativa mais robusta:** após o envio, fazer `select` em `chat_conversations` por `(client_id, contact_phone)` ordenado por `created_at desc limit 1` para capturar o `conversation_id` recém-criado.

### 3.5 `DealDetailsSheet.tsx` — card roxo Jul.IA

Quando o deal é Júlia (`juliaContext.isJulia`):

- **Manter** o card de "Conversa do chat" existente (com botão "Abrir no Chat") — sem alteração.
- **Adicionar abaixo** um novo bloco visual roxo (`bg-purple-500/5 border-purple-500/30 rounded-lg p-4`):
  - **Linha 1:** Ícone `Scale` roxo + título `Vínculo com a Jul.IA`.
  - **Contato:** nome em destaque + número WhatsApp (formatado) abaixo.
  - **Linha de fila:** mesmo badge da fila já mostrado no card.
  - **Badge agente:** `#{codAgent} - {alias}` (estilo Júlia).
  - **Barra de ícones de ação** (todos `rounded-full`, espaçados):
    - 👁️ **Olho** (azul) — abre o `CRMLeadDetailsDialog` da Júlia (já existente no projeto). Ação: importar e renderizar com `whatsappNumber={contact_phone}, codAgent`. Reutiliza componente sem duplicação.
    - 📄 **Contrato** (Scale/FileText) — `disabled` se sem contrato; **azul** se gerado, **verde** se assinado. `onClick` abre **um segundo Sheet** (lateral, ao lado do já aberto, side="right" empilhado com largura menor) com os dados do contrato — padrão visual do `ContactDetailPanel` do `/atendimento-humano`.
    - 🤖 **Bot** — vermelho se agente parado, verde se ativo (reaproveita `AgentStatusIcon` já existente, mem://ui/patterns/agent-status-indicator-v3).
  - **Badge etapa atual:** badge clicável com a `stage_name + stage_color` do card Júlia. Ao clicar → `navigate(`/crm?whatsapp=${normalizedPhone}`)` para aplicar filtro no CRM Júlia. (Verificarei a query string aceita pelo `/crm`; se for outra, ajustar.)

**Importante:** todos os recursos consumidos aqui (`CRMLeadDetailsDialog`, `AgentStatusIcon`, query de contrato, query de etapa) já existem no projeto. **Nenhum hook novo de Júlia** precisa ser criado além do `useDealJuliaContext` que orquestra.

### 3.6 Página de cards (lista/board) — ícone amarelo

Como o `DealCard` é usado tanto no `BoardPage` quanto na lista, a alteração de 3.3 cobre ambos. Não há outro lugar a tocar.

---

## ✅ Garantias de não-regressão

1. **Frente 1** apenas adiciona um botão; nenhuma lógica existente é alterada.
2. **Frente 2** introduz `ContactPicker` em arquivo novo; o `CreateCrmCardSheet` (criação a partir do chat) **não muda** — continua com o fluxo atual. Só o `CreateDealDialog` (criação manual no board) é refatorado.
3. **Frente 3**: badges e ícones são acrescentados condicionalmente. Se `useDealJuliaContext` retornar `isJulia=false` (caso atual), o card permanece idêntico ao de hoje.
4. **Schema**: nenhuma migration é necessária. Todos os campos já existem (`chat_contacts`, `chat_conversations`, `crm_deals.custom_fields`, `crm_atendimento_cards`).
5. **Realtime**: nenhuma assinatura nova; tudo via `useQuery` com `staleTime`.

---

## 📋 Arquivos editados/criados

**Editados:**
- `src/pages/crm-builder/components/deals/DealCard.tsx` (botão telefone, ícone WhatsApp amarelo, badge Jul.IA roxo, badge agente)
- `src/pages/crm-builder/components/deals/CreateDealDialog.tsx` (largura + ContactPicker + auto-link chat)
- `src/pages/crm-builder/components/deals/DealDetailsSheet.tsx` (bloco Jul.IA roxo + ações)
- `src/components/chat/NewConversationDialog.tsx` (props `initialName`, `lockContact`, `onConversationStarted`)

**Criados:**
- `src/pages/crm-builder/components/deals/ContactPicker.tsx`
- `src/pages/crm-builder/hooks/useDealJuliaContext.ts`
- `src/pages/crm-builder/hooks/useChatContactConversationStatus.ts`
- `src/pages/crm-builder/hooks/useContactConversation.ts` (lookup conversa por contact_id)

---

## ⚠️ Pontos para confirmar antes de codificar

1. **Filtro do CRM Júlia por WhatsApp**: o badge "etapa atual" deve navegar para `/crm?whatsapp=NUMERO` ou outro parâmetro? Vou verificar a página `/crm` e usar o querystring correto (provavelmente já aceito pelo módulo `lead-ownership-logic-v2`).
2. **Contrato do contato**: existe uma tabela/hook único para buscar contrato por WhatsApp? Vou inspecionar `mem://features/estrategico/contract-deletion-workflow` e usar o mesmo source. Se não houver hook, criarei query inline mínima.
3. **Status do agente (Bot)**: usarei `AgentStatusIcon` que já existe (mem://ui/patterns/agent-status-indicator-v3).

Esses pontos serão **lidos durante a implementação** (sem precisar te perguntar agora) — se algo não bater, faço o caminho mínimo seguro e aviso na entrega.
