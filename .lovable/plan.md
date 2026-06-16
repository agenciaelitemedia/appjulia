## Objetivo

Adicionar uma nova aba **"Distribuição Automática"** em `/chat/configuracoes` que permita ao dono do escritório configurar regras de distribuição automática de novos chats entre os atendentes do **mesmo client_id**, com **switch master** para ativar/desativar o sistema todo.

A infraestrutura já existe (tabelas `chat_routing_rules`, `chat_agent_capacity`, edge function `chat-route-conversation`, hook `useChatRouting`, página `ChatRoutingPage`), mas está **órfã** — não há rota e ninguém invoca a função. Vamos integrá-la ao fluxo e expor na UI.

---

## Identidade dos atendentes (importante)

A partir desta versão, **nenhuma regra usa `cod_agent`**. Tudo é identificado por:

- **`client_id`** (escritório) — escopo de todas as regras (`chat_routing_rules.client_id`).
- **`user_id`** (membro do time daquele client_id) — identifica cada atendente dentro dos campos `agent_pool[]`, `excluded_agents[]`, `fallback_assigned_to`, `chat_agent_capacity.agent_identifier`, `chat_conversations.assigned_to`.

Os seletores de atendentes na UI listam membros via `useTeamByClient(clientId)` e gravam o `user_id` (string). A função `filterPoolByQueueAccess` deixa de mapear `cod_agent → user_id` (passa a comparar `user_id` direto contra `list_users_for_queue`).

---

## 1. UI — Nova aba em Configurações do Chat

Arquivo: `src/pages/chat/ChatSettingsPage.tsx`

- Adicionar `TabsTrigger value="distribuicao"` (ícone `GitFork`) ao lado de "Automações".
- Criar `src/pages/chat/components/ChatAutoDistributionTab.tsx`:
  1. **Card de status** com switch master "Distribuição automática ativada" (persistido em `chat_client_settings.settings.auto_distribution_enabled`, escopado por `client_id`).
  2. Conteúdo embarcado da `ChatRoutingPage` (extrair em `ChatRoutingContent` exportado, padrão `ChatSlaConfigContent`).
  3. Quando master desligado: badge "Inativo — regras não serão aplicadas".

---

## 2. Tipos de regras suportadas

### Condições (`conditions`, AND)
- `channel`, `tag`, `priority`, `keyword`, `business_hours`
- **Novo** `queue` — id da fila de origem
- **Novo** `contact_is_new` — primeira conversa do contato

### Estratégias (`strategy`)
- `round_robin`, `least_busy`, `specific_agent`, `manual_pool`
- **Novo** `random`

### Filtros de elegibilidade do atendente (NOVO)
Aplicados **antes** da estratégia, todos por `user_id`:

- **`online_only`** (boolean por regra) — apenas atendentes do `client_id` com presença online: `user_presence.last_seen_at >= now() - 5 min` AND (opcional) `chat_agent_capacity.status='online'`.
- **`excluded_agents[]`** (NOVO `text[]` de `user_id`) — atendentes ignorados sempre nesta regra (férias, gestor, etc.).
- Pool vazio após filtros → cai em `fallback_assigned_to`.

### Campos da regra
- Nome, descrição, ativa/inativa, posição
- `agent_pool[]` (user_ids), `excluded_agents[]` (user_ids), `fallback_assigned_to` (user_id)
- `online_only`, `target_queue_id`, `only_business_hours`
- Capacidade por agente (`chat_agent_capacity` chaveada por `client_id` + `agent_identifier=user_id`)

### Métricas
- `execution_count`, `last_executed_at`, `last_assigned_to` (já existem).

---

## 3. UI dos novos campos (editor da regra)

- Switch **"Somente atendentes online"**.
- Multi-select **"Ignorar atendentes"** (mesmo componente do `agent_pool`, grava em `excluded_agents`). Tooltip: "Estes atendentes nunca receberão chats por esta regra."
- Todos os selects de atendente leem de `useTeamByClient(clientId)` e gravam `user_id`.

---

## 4. Wire-up — Disparar a distribuição

Hoje `chat-route-conversation` não é chamada:

- Em `supabase/functions/uazapi-chat-webhook/index.ts`, após criar/atualizar `chat_conversations` em `pending` sem `assigned_to`:
  1. Ler flag `auto_distribution_enabled` via `fetchClientAutomationFlags(client_id)` (estender `_shared/agentSettings.ts`).
  2. Se ligada, `waitUntil(fetch /functions/v1/chat-route-conversation { conversation_id })`.
- Guard no início de `chat-route-conversation/index.ts` revalida a flag por `client_id`.

---

## 5. Banco de dados

Migration:
```sql
ALTER TABLE public.chat_routing_rules
  ADD COLUMN excluded_agents text[] NOT NULL DEFAULT '{}',
  ADD COLUMN online_only boolean NOT NULL DEFAULT false;
```
- `chat_routing_rules.cod_agent` permanece apenas como metadado (não usado pela engine).
- `auto_distribution_enabled` mora em `chat_client_settings.settings` (JSONB, sem schema change).

---

## 6. Hook e tipos

- `src/hooks/useChatRouting.ts`: adicionar `excluded_agents: string[]`, `online_only: boolean`; estender `field` com `'queue' | 'contact_is_new'`; estender `strategy` com `'random'`. Remover qualquer referência implícita a `cod_agent`.
- `src/pages/configuracoes/hooks/useChatClientSettings.ts`: `auto_distribution_enabled?: boolean` (default `false`).

---

## 7. Lógica no edge function (`chat-route-conversation`)

Em `pickAgent(rule)`:
```
pool = rule.agent_pool                            // user_ids
pool -= rule.excluded_agents                      // user_ids
pool = filterPoolByQueueAccess(pool, rule.target_queue_id, rule.client_id)
if rule.online_only:
  pool = filterByOnlinePresence(pool, rule.client_id)
if empty(pool): return rule.fallback_assigned_to
apply strategy
```

- `filterPoolByQueueAccess`: usa `list_users_for_queue` (que já retorna `user_id` no escopo do `client_id`) e intersecta direto com o pool. **Mapeamento `cod_agent → user_id` removido.**
- `filterByOnlinePresence`: `db-query` raw → `SELECT user_id FROM user_presence WHERE user_id = ANY($1) AND client_id = $2 AND last_seen_at >= now() - interval '5 minutes'`.

---

## 8. Permissões

- Aba visível com `hasPermission('chat','can_edit')`.
- Owner pode delegar via módulo `team`.

---

## Arquivos tocados

```
src/pages/chat/ChatSettingsPage.tsx                            (add tab)
src/pages/chat/components/ChatAutoDistributionTab.tsx          (new)
src/pages/chat/ChatRoutingPage.tsx                             (extract embeddable + novos campos + selects por user_id)
src/hooks/useChatRouting.ts                                    (extend types, remover cod_agent)
src/pages/configuracoes/hooks/useChatClientSettings.ts         (add flag)
supabase/functions/_shared/agentSettings.ts                    (expose new flag)
supabase/functions/uazapi-chat-webhook/index.ts                (invoke router)
supabase/functions/chat-route-conversation/index.ts            (guard + filtros + 'random' + remover map cod_agent)
supabase/migrations/<ts>_routing_rule_filters.sql              (excluded_agents + online_only)
```

---

## Fora do escopo

- WABA webhook wire-up (próxima iteração).
- Painel gráfico de auditoria — `chat_conversation_history` já registra `auto_routed`.
