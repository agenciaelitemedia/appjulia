

## Objetivo
Substituir o badge **J/H** atual (baseado apenas em status da Julia) por um badge **contextual à fila da conversa**, com semântica diferente para filas com agente IA vinculado vs. filas sem agente. Atualizar o filtro do `/chat` para refletir os mesmos critérios.

## Regras novas

| Cenário da fila da conversa | Ícone | Verde quando | Vermelho quando |
|---|---|---|---|
| Fila vinculada a um agente IA (existe `queue_agent_links`) | 🤖 (Bot) | Sessão da IA está **ativa** (`isActive=true`) | Sessão **inativa** (humano assumiu) |
| Fila SEM agente IA vinculado | 👤 (User/Humano) | Conversa tem `assigned_to` (atendente atribuído) | `assigned_to` vazio (não atribuído) |

Conversa sem fila resolvida → fallback para o comportamento atual (usa `cod_agent` da conversa) ou esconde se não houver dados.

## Mudanças

### 1. Novo hook `useQueueAgentLink(queueId)`
- Arquivo: `src/hooks/useQueueAgentLink.ts`.
- Consulta `queue_agent_links` filtrando por `queue_id`. Retorna `{ hasAgent, codAgent }` (preferindo `is_primary=true`).
- Cache via React Query (`staleTime: 5min`, key `['queue-agent-link', queueId]`) — uma única request por fila reaproveitada por todas as conversas.

### 2. Refatorar `JuliaStatusBadge` → `ConversationStatusBadge`
- Arquivo: `src/components/chat/JuliaStatusBadge.tsx` (mantém o nome do arquivo e re-export `JuliaStatusBadge` como alias para não quebrar `/atendimento-humano`, CRM, Campanhas, Contratos).
- Nova prop opcional `queueId?: string | null` + `assignedTo?: string | null`.
- Lógica:
  - Se `queueId` → busca link com `useQueueAgentLink`.
    - **Tem agente IA** → ícone `Bot` (verde se IA ativa, vermelho se inativa) — usa `useAgentSessionStatus` com o `codAgent` resolvido pelo link.
    - **Sem agente IA** → ícone `User` (verde se `assignedTo` preenchido, vermelho se vazio).
  - Se `queueId` ausente → comportamento legado (usa `whatsappNumber` + `codAgent` props, mostra J/H como hoje) — preserva os outros módulos.
- Tooltips: "Julia ativa", "Julia inativa", "Atendente atribuído: <nome>", "Sem atendente".

### 3. Plugar nos componentes do `/chat`
- `ChatContactItem.tsx`: passar `queueId={conversation?.queue_id}` e `assignedTo={conversation?.assigned_to}`.
- `ChatHeader.tsx`: idem, com `selectedConversation?.queue_id` e `selectedConversation?.assigned_to`.

### 4. Atualizar filtro do `/chat` (`ChatList.tsx`)
- Renomear `juliaFilter` → `conversationModeFilter` com 3 valores:
  - `all` — Todas
  - `bot_active` — Bot ativo (verde) — engloba IA ativa OU fila s/ agente com atendente atribuído
  - `bot_inactive` — Sem bot/atendente (vermelho) — IA inativa OU fila s/ agente e sem `assigned_to`
- Pré-cálculo: para cada conversa visível, derivar `mode` ('bot' | 'human') e `state` ('green' | 'red'):
  - Map `queueId → hasAgent/codAgent` carregado de uma única consulta a `queue_agent_links` filtrando por todos os `queue_id`s presentes nas conversas visíveis (`useQueueAgentLinks(queueIds[])` — versão batch).
  - Para filas com agente: lê cache `['agent-session-status', codAgent, phone]` (igual ao filtro atual).
  - Para filas sem agente: usa `conversation.assigned_to`.
- Rótulos do ToggleGroup: ícone `Bot` verde + "Ativos" / ícone `User` vermelho + "Pendentes" (textos finais a confirmar — manter cores verde/vermelho).
- Os outros filtros (SLA, fila, status pills) ficam intactos.

### 5. Hook batch `useQueueAgentLinks(queueIds[])`
- Mesma tabela, filtro `.in('queue_id', queueIds)`. Retorna `Map<queueId, { hasAgent, codAgent }>`.
- Usado pelo `ChatList` para evitar N requests.

## Compatibilidade / não-quebra
- `JuliaStatusBadge` exportado como alias do novo componente; chamadas existentes sem `queueId` (em `/atendimento-humano`, CRM, Campanhas, Contratos) caem no caminho legado e continuam mostrando J/H exatamente como hoje.
- `JuliaStatusFilter` type continua exportado para compat de `CRMPage`.
- Edge functions, schema do banco e tabela `queue_agent_links` não mudam.
- Nenhum impacto em SLA, fila selector, pills de status, individual/grupos.

## Arquivos previstos
- `src/hooks/useQueueAgentLink.ts` (novo) — single + batch.
- `src/components/chat/JuliaStatusBadge.tsx` — refatorado, retro-compatível.
- `src/components/chat/ChatContactItem.tsx` — passar `queueId`/`assignedTo`.
- `src/components/chat/ChatHeader.tsx` — passar `queueId`/`assignedTo`.
- `src/components/chat/ChatList.tsx` — novo filtro com modos Bot/Humano.

## Validação
- Conversa em fila com agente IA ativo → badge Bot verde; ao humano enviar mensagem → vira Bot vermelho.
- Conversa em fila SEM agente IA, sem `assigned_to` → badge Humano vermelho; ao atribuir atendente → vira Humano verde.
- Filtro "Ativos" mostra ambos os casos verdes; "Pendentes" mostra ambos os vermelhos.
- `/atendimento-humano`, CRM, Campanhas e Contratos continuam exibindo J/H idêntico ao hoje.

