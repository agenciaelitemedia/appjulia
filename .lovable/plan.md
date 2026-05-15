## Diagnóstico

Investiguei os dados reais e encontrei **duas causas distintas**:

### 1. Contagem zerada de Chats e CRM
As colunas `assigned_to` guardam valores diferentes em cada tabela:

| Tabela | `assigned_to` armazena |
|---|---|
| `tasks` | **id numérico** do usuário (ex.: `2`) |
| `chat_conversations` | **nome** do usuário (ex.: `Julia Deluque`, `VICTORIA`) |
| `crm_deals` | **nome** do usuário (ex.: `VICTORIA`, `Loany Mayara`) |

O hook atual filtra os 3 com `idsAsText` (lista de ids como `'1','2','3'`), por isso só `tasks` retorna alguma coisa e Chats/CRM ficam zerados.

### 2. Usuário logado aparece offline
Hoje há **dois `supabase.channel('presence:client:{id}')` separados**:

- `useGlobalPresence` (no `MainLayout`) → faz `track()` com `key = user.id`
- `useTeamPresence` (no Dashboard) → cria outro canal com `key = observer-${user.id}` só para ler

Cada `supabase.channel()` cria uma instância nova; o Supabase Realtime não merge automaticamente o estado entre instâncias do mesmo cliente, então o leitor não enxerga o próprio track e mostra "Offline".

---

## Plano de correção (apenas frontend)

### A) Presence: canal singleton compartilhado

Criar `src/lib/presenceChannel.ts` com um **singleton por `client_id`**:

```text
getPresenceChannel(clientId) → reutiliza ou cria 1 canal
  - track(meta)            → anuncia o user atual
  - subscribe(listener)    → notifica mudanças de presença
  - getOnlineIds()         → Set<number>
```

Refatorar:
- `useGlobalPresence` → usa o singleton, chama `track({ user_id, name, avatar })` uma única vez por sessão.
- `useTeamPresence` → usa o **mesmo** singleton; ouve `presence sync/join/leave` e devolve `onlineIds`. Não cria novo canal nem usa key `observer-…`.

Isso garante que o usuário logado apareça online imediatamente após abrir o Dashboard.

### B) Métricas: match correto por nome ou id

Atualizar `useTeamDashboardMetrics(rows)` para receber `Array<{ id, name }>` em vez de só ids, e fazer:

- **tasks** → continua filtrando por `assigned_to IN (ids como texto)`.
- **chat_conversations** → filtrar `assigned_to IN (nomes)`; agregar contagens em mapa `name → count` e depois resolver para `id` via `name → id`.
- **crm_deals** → idem `chat_conversations` (por nome). Adicionar filtro `client_id` quando disponível para evitar contar deals de outros clientes.

Edge cases:
- nomes duplicados na equipe → somar tudo na mesma chave (improvável, mas cobrir).
- `assigned_to` vazio/null → ignorar.
- comparação case-insensitive opcional (mantemos exato porque os dados estão consistentes).

Atualizar `EquipeDashboardTab` para passar `[{id, name}]` em vez de só ids.

### C) Ordenação Online primeiro

A ordenação `online → offline → alfabético` já está implementada corretamente em `EquipeDashboardTab.tsx` linhas 54–61. Após corrigir o presence (item A), o usuário logado naturalmente aparecerá no topo. Sem mudança adicional.

---

## Arquivos afetados

- **Criar:** `src/lib/presenceChannel.ts`
- **Editar:** `src/hooks/useGlobalPresence.ts`, `src/hooks/useTeamPresence.ts`, `src/hooks/useTeamDashboardMetrics.ts`, `src/pages/equipe/components/EquipeDashboardTab.tsx`

Sem mudanças de schema, RLS ou backend.