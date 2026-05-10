## Objetivo

Hoje a lista do chat carrega ~50 contatos por página e aplica vários filtros (Modo Julia/Humano, Atendente, Etapa CRM, Ordenação, Status, Período) **client-side** sobre o que já está em memória. Resultado: ao mudar qualquer filtro o usuário só vê o subconjunto da página atual e precisa "Carregar mais" para revelar conversas que casariam o filtro mais adiante.

A meta é fazer **todo filtro acionado bater no banco**, devolvendo o universo completo daquela combinação e aplicando paginação progressiva sobre esse universo (mesmo padrão de "Carregar mais (X de XXX) / Fim da lista" já em uso na busca).

Sem mudanças de schema. Os dados continuam em duas fontes: Supabase (`chat_contacts`, `chat_conversations`) e External DB (`agent_sessions` para Julia ativa, `crm_atendimento_cards` para etapas).

## Arquitetura: filtro = WHERE no servidor + paginação no resultado

### Filtros nativos do Supabase (vão direto na query)

Todos aplicados em `chat_contacts` (lista principal) e em paralelo em `chat_conversations` (para badges/contagem por aba):

| Filtro | Coluna | Estratégia |
|---|---|---|
| Aba Individual/Grupos | `chat_contacts.is_group` | `eq` |
| Status (pending/open/resolved_closed) | `chat_conversations.status` + `assigned_to` (regra "pending+assignee = open") | `in` + filtro derivado |
| Fila | `chat_contacts.channel_source` / `chat_conversations.queue_id` | `eq`/`in` |
| Atendente (Meus / Não atribuídos / membro X) | `chat_conversations.assigned_to` | `eq`, `is null`, ou `eq <id>` |
| Período | `chat_contacts.last_message_at` | `gte` |
| Snooze | `chat_conversations.snoozed_until` | `or(is.null,lt.now)` |
| Busca | nome/telefone | `or` (já existe) |
| Ordenação (newest/oldest) | `last_message_at` | `order` |

### Filtros que dependem do External DB (resolvem em duas etapas)

Para **Modo (Julia/Humano)** e **Etapa CRM**, resolver o conjunto de **telefones elegíveis** no external DB primeiro, depois passar esse conjunto como `in('phone', […])` na query do Supabase.

- **Modo = Julia ativa** → SELECT `whatsapp_number` FROM `agent_sessions` WHERE `cod_agent` IN (agentes vinculados às filas acessíveis do usuário) AND `active = true`. Aplicar variantes BR (com/sem 55, com/sem 9) ao montar o `in`.
- **Modo = Humano (Julia inativa)** → mesma query com `active = false` (override humano confirmado). Conversas `unknown` continuam fora desse filtro (decisão da iteração anterior).
- **Etapa CRM** → SELECT `phone` FROM `crm_atendimento_cards` WHERE `stage_id` IN (selecionados). Aplicar variantes BR.

Os dois conjuntos viram um único `phoneAllowlist` (interseção quando ambos os filtros estão ativos). O `phoneAllowlist` é cacheado por React Query e usado como filtro adicional no Supabase.

Limite prático: o Supabase aceita listas grandes em `in()` (até alguns milhares). Quando o conjunto exceder ~5k telefones, dividir em batches sequenciais e mesclar IDs no client (ou cair para um filtro alternativo via RPC futura — fora de escopo agora).

## Onde mexer

### 1. `WhatsAppDataContext.tsx`

- Estender `loadContacts` / `loadConversations` para receber e aplicar os filtros novos:
  - `assignedTo` (id, 'unassigned', ou ausente),
  - `phoneAllowlist` (`string[] | null`),
  - manter `currentQueueId`/`activeQueueIds`, `periodFilter`, `sortOrder`, status já existentes.
- Mudar dependências do `useCallback` para refazer a paginação a partir do offset 0 sempre que qualquer filtro mudar.
- Expor `totalContacts` e `totalConversationsByStatus` (count exact) para alimentar contadores das abas e do rodapé "(X de XXX)".
- Reset automático do offset quando qualquer filtro relevante mudar (já existe parcialmente para queue/period/sort).

### 2. Novos hooks de pré-resolução (External DB)

- `useJuliaActivePhones({ codAgents, mode })` → retorna `string[]` de telefones (em variantes) com `active=true|false` para os `cod_agent` das filas acessíveis. Cacheado 30s.
- `useStagePhones({ stageIds })` → telefones em `crm_atendimento_cards` para os stages selecionados. Cacheado 60s.
- `usePhoneAllowlist({ modeFilter, stageIds, codAgents })` → composição (interseção) dos dois.

### 3. `ChatList.tsx`

- Remover os filtros client-side correspondentes (mode, owner, stage, period redundante). Substituir por:
  - chamadas a `setOwnerFilter`/`setStageIds`/`setModeFilter` que disparam o reload server-side via dependências do contexto.
  - O `phoneAllowlist` calculado no client é repassado ao contexto via novo setter (`setPhoneAllowlist`).
- O memo `searchView` continua aplicando aba (Individual/Grupos) e status (pending/open/resolved_closed) sobre o resultado da busca, mas a busca server-side já passa a respeitar `assigned_to`, `phoneAllowlist` e período.
- Contagem por aba (`effPendingConvCount`, `effOpenConvCount`, `effClosedConvCount`) passa a vir de **3 queries `count: 'exact'`** em paralelo (uma por status), com os mesmos filtros. Mantém o padrão "(loaded de total da aba)" no rodapé.

### 4. Footer de paginação

Continua como hoje (a iteração anterior já parametrizou por aba). Os números `activeTabLoaded` e `activeTabTotal` agora refletem totais reais do banco para a combinação ativa.

## Fluxo de re-fetch

```text
qualquer setter de filtro
       │
       ▼
contexto reseta offset=0 e dispara loadContacts (page 1) + loadConversations (page 1) + 3 counts (count exact por status)
       │
       ▼
ChatList renderiza primeiros 50, mostra "Carregar mais (50 de N)"
       │
       ▼ click ou scroll-sentinel
loadMoreContacts/Conversations append próximo range com mesmos filtros
```

## Detalhes técnicos

- Cuidado de performance: as 3 queries de count + lista de contatos + lista de conversas + 1–2 pré-resolves do external DB rodam em paralelo. Tempo total esperado < 400ms para a maioria dos clientes.
- Cuidado com `phoneAllowlist` vazio: significa "nenhum telefone casa o filtro" → curto-circuitar a query do Supabase (não enviar `in('phone', [])`, devolver lista vazia direto).
- Período já é server-side em `loadContacts`; verificar consistência com o filtro de período usado no client e remover o duplo filtro client-side.
- Realtime: as inserções em `chat_conversations` continuam atualizando o estado local; quando filtros server-side estão ativos, validar a nova linha contra os filtros antes de inserir (caso contrário a lista cresce com itens que não casam).
- Manter os `useQuery` da busca com a nova lógica: quando há `phoneAllowlist`, aplicar `in('phone', allowlist)` na busca também.

## Fora de escopo

- Filtros de tag e prioridade (não pedidos agora).
- Migrar `agent_sessions` ou `crm_atendimento_cards` para o Supabase (continua via External DB + intersect por phone).
- Index novos no External DB. Se as queries de pré-resolve ficarem lentas, criar índice numa próxima iteração.
- Mudar a estrutura de realtime ou o canal de eventos.
