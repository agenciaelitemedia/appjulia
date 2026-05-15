## Objetivo

Tornar o status de online/offline do dashboard de Equipe confiável, mesmo quando o navegador suspende a aba, troca de rede ou fecha sem disparar o `leave` do websocket. Adicionar fallback "ativo há X min" estilo WhatsApp.

## Como vai funcionar

Três camadas combinadas:

1. **Presence (websocket)** — mantém o ponto verde instantâneo quando a aba está ativa e conectada (lógica que já existe).
2. **Heartbeat no banco** — cada cliente grava `last_seen_at = now()` a cada 30s numa tabela `user_presence`. Considerado **online** se `last_seen_at` foi nos últimos **75s** (2 heartbeats + folga).
3. **Última atividade** — quando offline, mostra "ativo há 2 min", "ativo há 1 h", "ativo há 3 d", em vez de só "Offline".

Resultado: o ponto fica verde se **qualquer uma** das duas fontes (Presence OU heartbeat recente) indicar online. Some sozinho ~75s depois que o usuário fecha tudo.

## Banco de dados

Nova tabela `public.user_presence`:

```text
user_id        bigint   PK
client_id      bigint
last_seen_at   timestamptz
updated_at     timestamptz
```

- Índice em `(client_id, last_seen_at desc)`.
- RLS: `select` permitido para qualquer autenticado do mesmo `client_id`; `update/insert` apenas do próprio `user_id`.
- Adicionar a tabela ao `supabase_realtime` para receber `postgres_changes` quando alguém atualiza o heartbeat (vira "online" instantâneo no painel mesmo se Presence ainda não sincronizou).

## Frontend

### Novo hook `useHeartbeat`
- Roda no `MainLayout` (ao lado do `useGlobalPresence`).
- Faz upsert em `user_presence` a cada **30s** enquanto a aba estiver visível.
- Pausa quando `document.visibilityState === 'hidden'` (economiza); re-dispara um upsert imediato ao voltar a ficar visível, focar a janela ou reconectar à internet.

### Novo hook `useTeamHeartbeat(userIds)`
- `select` inicial em `user_presence` para pegar `last_seen_at` dos membros.
- Subscreve `postgres_changes` em `user_presence` (filtrado por `client_id`) para invalidar a query e atualizar em tempo real.
- Refetch silencioso a cada 30s para envelhecer o "ativo há X" sem depender de evento.

### `EquipeDashboardTab`
- Combinar presença: `online = onlineIds.has(id) || (now - last_seen_at) < 75s`.
- Coluna **Status**: continua mostrando "Online" / "Offline".
- Se `online = false` e existe `last_seen_at`, abaixo do badge mostrar texto pequeno: "ativo há 2 min" (utilitário de formatação relativa em pt-BR, com cap em "ativo há mais de 7 dias").
- Card "Online" no topo continua igual — passa a refletir a presença combinada.

## Observações técnicas

- `user_presence` é independente da `user_activity_log` (que registra login/logout discretos). Mantemos as duas: a primeira é heartbeat contínuo, a segunda é evento auditável.
- Heartbeat só roda em rotas dentro de `MainLayout` (todo usuário logado passa por ela), então cobre 100% do app.
- Sem `pg_cron` necessário — a "expiração" é calculada no client comparando `now()` com `last_seen_at`.

## Arquivos afetados

- **Migração nova**: cria `user_presence`, RLS, índice, publica em `supabase_realtime`.
- **Novo**: `src/hooks/useHeartbeat.ts`, `src/hooks/useTeamHeartbeat.ts`, `src/lib/relativeTime.ts`.
- **Editado**: `src/components/layout/MainLayout.tsx` (chamar `useHeartbeat`), `src/pages/equipe/components/EquipeDashboardTab.tsx` (combinar fontes + texto "ativo há…").
- **Mantido como está**: `useGlobalPresence`, `presenceChannel.ts` (Presence segue funcionando como camada instantânea).
