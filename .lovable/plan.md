# Plano: acelerar CRM Builder e Chat

Análise cruzada de código (dois agentes independentes) + slow queries do banco. Cada fase é independente e reversível — pode ser aprovada isoladamente.

Regras que **nenhuma mudança pode quebrar**: dedup de contatos entre filas, leader logic, anti-echo, human override da IA, isolamento por fila, RLS, drag-and-drop otimista do CRM, fallback de hidratação de contato/fila do painel lateral, ordenação cronológica das conversas.

---

## Diagnóstico consolidado (evidências)

**Banco (pg_stat_statements — top offenders):**
- `chat_messages` sendo consultada 367k+ vezes com `message_id = ? OR external_id = ? OR message_id ILIKE ? OR external_id ILIKE ?` (múltiplos pares OR encadeados), média **2.081 ms**, total **~764 mil segundos** de tempo de DB. Sozinha domina o consumo de CPU do Postgres → satura a instância e torna tudo o mais lento, inclusive `/chat` e CRM. Origem: pipeline de ingestão (`uazapi_history_items`).
- `chat_contacts.unread_count` UPDATE (1,6M chamadas) e insert em `chat_messages` (424k, média 168 ms) — sintoma da ingestão saturada, não causa raiz.

**Chat (`/chat`):**
- `useContactLatestConversation` carrega **até 20.000 linhas** de `chat_conversations` do cliente inteiro **em toda montagem do `/chat`**, sem filtro de fila/status, só para montar o mapa de "líder" (dedup). Abre um **segundo canal Realtime** duplicando o do contexto.
- `WhatsAppDataContext` faz auto-load de até **5.000 conversas ativas** antes de `isReady` ficar `true`, atrasando deep-links do CRM.
- `useChatAssignedCountsByMember` abre canal Realtime **sem filtro `client_id`** → invalida query a cada mudança em qualquer cliente da instância.
- `loadMessages` usa `select('*')`; `MessageBubble` **não é memoizado**; `ChatMessages` **não é virtualizado** (só `ChatList` é).
- Handler de INSERT em `chat_messages` (contexto) invoca `chat-automation-engine` e `chat-webhook-dispatcher` do **client-side** → dispara N vezes se N abas estão abertas.

**CRM Builder (`/crm-builder`):**
- `useCRMBoards`, `useCRMPipelines`, `useCRMDeals`, `useCRMCustomFields` usam `useState`+`useEffect` **sem React Query** → nenhum cache entre navegações; toda entrada num board refaz 4 fetches.
- `useCRMBoards` é chamado **duas vezes** dentro do BoardPage (a segunda só para popular "mover para outro board" no menu).
- Realtime de deals dispara `fetchDeals()` **completo** a cada mudança (já há debounce, mas o payload total é sempre re-baixado).
- `DealCard` **não é memoizado**; handlers em `BoardPage` são recriados inline em cada render → todos os cards visíveis re-renderizam durante o drag (que muda `deals` a cada `onDragOver`).
- `useDealConversation` é invocado **2× por card** (direto no DealCard + dentro de `useDealJuliaContext`). React Query dedup só de rede, não do overhead de hook.
- Três estados de loading independentes (`isLoadingBoard`/`isLoadingPipelines`/`isLoadingDeals`) causam efeito de "pulo" visual.

---

## Fase 1 — Correções de altíssimo impacto e baixo risco (fazer primeiro)

### 1.1 Eliminar consulta duplicada de conversas no Chat
Remover a fonte redundante de conversas em `src/hooks/useContactLatestConversation.ts` e reconstruir `leaderByContact` a partir do array `conversations` que o `WhatsAppDataContext` **já mantém**. Efeitos:
- Elimina até 20.000 linhas trafegadas por abertura do `/chat`.
- Fecha um canal Realtime redundante em `chat_conversations`.
- Mantém a mesma lógica de "líder mais recente por contato" (mesma função `buildLeaderMap`, só muda a fonte).

Validação obrigatória: contato com conversa ativa em fila A + resolvida em fila B; troca de fila; troca de aba `pending`/`open`/`resolved_closed`; deep-link do CRM caindo na aba certa.

### 1.2 Reduzir auto-load inicial de 5.000 → 1.000 conversas ativas
Baixar `CONV_AUTOLOAD_ACTIVE_MAX_PAGES` de 21 para 1 no boot (mantendo `loadMoreConversations` para completar em segundo plano). `hasLoadedConversationsOnce` vira `true` muito mais rápido → `isReady` libera antes → deep-links do CRM abrem mais cedo.

Risco: aba "todas" pode não mostrar conversas muito antigas até o load-more ser acionado. Aceitável porque o mecanismo já existe.

### 1.3 Corrigir escopo do canal Realtime em `useChatAssignedCountsByMember`
Adicionar `filter: 'client_id=eq.${clientId}'` no `.on('postgres_changes', ...)`. Correção pura de filtro, sem mudança funcional visível.

### 1.4 Trocar `select('*')` de `loadMessages` por lista de colunas explícita
Mesmo padrão de `CONV_COLUMNS`/`DEAL_SELECT_COLUMNS`. Reduz payload por página de mensagens em ~30-40%.

### 1.5 `React.memo` em `MessageBubble` e `DealCard`
Comparador shallow padrão (as props já são objetos que trocam de referência quando mudam de conteúdo). Estabilizar handlers em `BoardPage` e `ChatMessages` via `useCallback`. Ganho grande durante drag no CRM e durante rajadas de status-tick no Chat, sem mudar comportamento.

### 1.6 Deduplicar o segundo `useCRMBoards` no `BoardPage`
Carregar a lista de "mover para outro board" **sob demanda**, só quando o `DealDetailsSheet` abrir o menu. Elimina uma query redundante em cada entrada de board.

---

## Fase 2 — Ganhos estruturais no CRM Builder (médio esforço, médio risco)

### 2.1 Migrar hooks primários do CRM para React Query
Converter `useCRMBoards`, `useCRMPipelines`, `useCRMCustomFields` (nesta ordem) para `useQuery` com `staleTime: 30_000`, `refetchOnWindowFocus: false`, `placeholderData: keepPreviousData`. As mutations (`create/update/reorder/archive`) viram wrappers que chamam `queryClient.setQueryData` para update otimista + `invalidateQueries` no sucesso. Shape de retorno preservado.

`useCRMDeals` fica para o fim porque tem lógica otimista complexa (`dealsRef`, `isMovingRef`, drag reorder). Migrar por último, com testes manuais de drag entre colunas e entre pipelines.

Efeito: voltar para um board já visitado passa a ser instantâneo (dados do cache) enquanto o refetch em background acontece.

### 2.2 Sincronizar skeletons do BoardPage
Adiar renderização da filtro-bar e do grid até `pipelines` estar disponível. Skeleton único até que "board + pipelines" estejam prontos; skeletons por coluna (já existentes) para os cards. Elimina o efeito de "pulo" em 3 fases.

### 2.3 Consolidar `useDealConversation` chamado 2× por card
`useDealJuliaContext` deve aceitar o resultado de `useDealConversation` como parâmetro (ou retornar tudo num único hook combinado). Elimina invocação duplicada sem tocar na lógica de fallback (`conversationId` vs `contactIdFallback`) que hoje resolve o badge Júlia.

---

## Fase 3 — Ataque à causa raiz do banco (alto impacto sistêmico)

### 3.1 Investigar e corrigir a query `chat_messages ... ILIKE` na ingestão
É a maior consumidora de CPU do Postgres do projeto — afeta **tudo**, não só o Chat. Provavelmente vem do worker de `uazapi_history_items` fazendo dedup por `message_id`/`external_id` com quatro variações (case-sensitive e case-insensitive) em OR encadeado, saturando o índice a cada mensagem recebida.

Ações:
1. Localizar o call-site exato (Edge Function/worker) — provavelmente `supabase/functions/uazapi-*` ou similar.
2. Substituir a consulta OR-com-ILIKE por consulta exata `.in('message_id', [...])` + `.in('external_id', [...])` em duas etapas (ou UNION ALL), eliminando o `ILIKE`.
3. Confirmar existência dos índices `idx_chat_messages_message_id` e `idx_chat_messages_external_id` (btree simples). Criar via migration caso falte.
4. `EXPLAIN ANALYZE` antes/depois em um `message_id` real para confirmar uso de index scan.

**Risco:** exige entender a origem exata do padrão ILIKE. Só executar depois de mapear o worker responsável e validar que a variação `ILIKE` não é semanticamente necessária (ex.: se algum provedor manda o ID com prefixo variável, precisa ser preservado — ou mudar para busca em coluna normalizada).

---

## Fase 4 — Ajustes finais (baixo impacto, opcionais)

- Realtime de `chat_messages` no contexto: mover o invoke de `chat-automation-engine`/`chat-webhook-dispatcher` para trigger de banco ou para uma única edge function server-side, eliminando N-abas × N-agentes de fan-out client-side. **Só executar após auditar as duas edge functions**.
- Realtime de `crm_deals`: aplicar patch incremental usando `payload.new`/`payload.old` em vez de refetch completo.
- Virtualização de `ChatMessages` com `@tanstack/react-virtual` (mesmo padrão já usado em `ChatList`), preservando o `IntersectionObserver` de topo para "load more" e o `scrollHeight` de anti-echo.

---

## Detalhes técnicos

- **Nenhuma mudança de schema/RLS/policies nas fases 1-2.** Fase 3 pode exigir migração para índices; será apresentada como migration separada com `GRANT` já configurado (não é necessário porque só cria índice, não tabela).
- **Sem mudança de contrato de props/tipos exportados**. `useCRMBoards`, `useCRMPipelines`, `useCRMDeals`, `useContactLatestConversation` continuam expondo `{ data, isLoading, refetch, ... }`.
- **Sem mudança em `src/integrations/supabase/client.ts`** (auto-gerado).
- Cada correção da Fase 1 é isolada e pode ser revertida individualmente.

## Ordem de execução recomendada

Fase 1 inteira (~1-2 sessões) → validar em produção → Fase 2 (~2-3 sessões) → Fase 3 (após auditoria do worker de ingestão) → Fase 4 (opcional).

Se quiser aprovar em bloco, faço a Fase 1 inteira num único build.
