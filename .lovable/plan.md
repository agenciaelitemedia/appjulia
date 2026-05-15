## Objetivo

Reestruturar o módulo **Equipe** em duas abas e adicionar um Dashboard com presença em tempo real, métricas por usuário, histórico de login/logout e logout automático por inatividade.

---

## 1. Reestruturação em abas

`src/pages/equipe/EquipePage.tsx` passa a renderizar `Tabs` com:

- **Dashboard** (nova aba, default)
- **Gestão de Equipe** (todo conteúdo atual: header, busca, grid, dialogs)

Conteúdo atual movido para `components/EquipeManagementTab.tsx`. Novo Dashboard em `components/EquipeDashboardTab.tsx`.

---

## 2. Controle de presença online/offline

**Abordagem: Supabase Realtime Presence** (mesmo padrão de `useConversationPresence.ts`).

Por quê:
- Ephemeral, sem escrita em DB para o "estado atual"
- Detecção automática de desconexão via heartbeat do canal
- Realtime nativo, sem polling
- Já existe precedente arquitetural no projeto

**Implementação:**

- `src/hooks/useGlobalPresence.ts` — canal único `presence:client:{client_id}` montado no `MainLayout`. Cada usuário faz `track({ user_id, name, avatar, online_at })` ao logar.
- `src/hooks/useTeamPresence.ts` — consome `presenceState()` e retorna `Set<user_id>` dos online.

---

## 3. Logging de login/logout (NOVO)

Como Presence é efêmero, precisamos persistir o **histórico** (último login / último logout) numa tabela.

**Nova tabela `user_activity_log`** (via migration):

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | bigint | FK lógica para `users.id` (DB externo) |
| `event_type` | text | `'login'` \| `'logout_manual'` \| `'logout_inactivity'` |
| `occurred_at` | timestamptz | default `now()` |
| `client_id` | bigint | para filtrar por cliente |

Índice em `(user_id, occurred_at DESC)` para lookups rápidos do "último de cada tipo".

**View `user_last_activity`** retorna por `user_id`: `last_login_at`, `last_logout_at`, `last_logout_type` (último evento de cada tipo).

**Edge function `log-user-activity`** (POST): valida JWT, recebe `{ event_type }`, insere registro. Mantemos isolado para garantir auditoria server-side.

**Pontos de chamada no AuthContext:**
- `login()` bem-sucedido → `event_type: 'login'`
- `logout()` manual → `event_type: 'logout_manual'`
- Logout por inatividade (no `setInterval` de checagem) → `event_type: 'logout_inactivity'`
- Bonus: `beforeunload` envia `logout_manual` via `navigator.sendBeacon` (best-effort) caso o usuário feche a aba sem clicar em Sair — opcional, a confirmar.

---

## 4. Logout automático por inatividade (30 min)

Já existe a infra em `AuthContext.tsx` com `INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000` (1h hoje).

Mudanças:
- Reduzir `INACTIVITY_TIMEOUT_MS` para `30 * 60 * 1000`
- No bloco que dispara o logout por expiração, registrar evento `logout_inactivity` antes de limpar storage e redirecionar para `/login`
- No `restoreSession`, quando detectar sessão expirada, também registrar `logout_inactivity` (uma única vez, idempotente o suficiente para auditoria)

---

## 5. Dashboard — métricas + histórico por usuário

`EquipeDashboardTab.tsx` renderiza uma **tabela** (mais densa que cards):

| Avatar + Nome | Status | Último login | Último logout | Chats abertos | Cards CRM | Tarefas abertas |

- **Status**: bolinha verde (online) / cinza (offline) via `useTeamPresence()`. Ordenação: online primeiro, depois alfabética.
- **Último login**: sempre exibido (formato `dd/MM HH:mm` + tooltip com data completa, locale ptBR).
- **Último logout**:
  - Se **online** → célula vazia (ou traço "—")
  - Se **offline** → mostra data/hora + badge pequeno indicando o tipo (`Manual` cinza / `Inatividade` âmbar)
- **Chats abertos**: count de `chat_conversations` onde `assigned_to = user_id` AND `status IN ('open','pending')`
- **Cards CRM**: count de `crm_deals` onde `assigned_to = user_id` AND estágio ≠ ganho/perdido
- **Tarefas abertas**: count de `tasks` onde `assigned_to = user_id` AND `status IN ('pending','in_progress')`

**Hooks:**
- `useTeamLastActivity(userIds[])` → consulta `user_last_activity`, `staleTime: 30s`, com Realtime subscription em `user_activity_log` para refrescar quando alguém logar/sair.
- `useTeamDashboardMetrics(userIds[])` → 3 queries agregadas (`group by assigned_to`) em paralelo via React Query, `refetchInterval: 60s`. Subscriptions Realtime em `chat_conversations`, `crm_deals` e `tasks` invalidam o cache.

Header do dashboard mostra totais agregados (X online de Y / Z chats / W tarefas).

---

## Arquivos

**Migration nova:**
- `user_activity_log` + view `user_last_activity` + RLS (somente admins / próprio usuário leem)

**Edge function nova:**
- `supabase/functions/log-user-activity/index.ts`

**Criar (frontend):**
- `src/hooks/useGlobalPresence.ts`
- `src/hooks/useTeamPresence.ts`
- `src/hooks/useTeamLastActivity.ts`
- `src/hooks/useTeamDashboardMetrics.ts`
- `src/lib/userActivityLog.ts` (helper que invoca a edge function)
- `src/pages/equipe/components/EquipeDashboardTab.tsx`
- `src/pages/equipe/components/EquipeManagementTab.tsx` (move conteúdo atual)
- `src/pages/equipe/components/TeamPresenceIndicator.tsx`

**Editar:**
- `src/pages/equipe/EquipePage.tsx` — wrap em `Tabs`
- `src/components/layout/MainLayout.tsx` — montar `useGlobalPresence`
- `src/contexts/AuthContext.tsx`:
  - Reduzir `INACTIVITY_TIMEOUT_MS` para 30 min
  - Chamar `logUserActivity('login')` no `login()`
  - Chamar `logUserActivity('logout_manual')` no `logout()`
  - Chamar `logUserActivity('logout_inactivity')` no disparo do logout por inatividade

---

## Pontos a confirmar

1. Para "Cards CRM atribuídos", quais estágios contam como "abertos"? Tudo exceto won/lost?
2. O dashboard deve ser visível para todos os usuários ou apenas admins/gestores?
3. 30 min de inatividade vale também para admins, ou admins ficam isentos?
4. Implementar o `beforeunload` + `sendBeacon` para capturar fechamentos de aba como `logout_manual`, ou tratar como "ainda online até o heartbeat do Presence cair"?
