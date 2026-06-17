---
name: Online time via heartbeats
description: Real online time tracked via 30s slots in user_presence_heartbeats, batched 2min/4 slots; sessions derived by grouping slots with gap ≤ 2min
type: feature
---
- Tabela `user_presence_heartbeats(user_id, client_id, seen_at)` PK (user_id, seen_at), idx (client_id, seen_at desc). Retenção 90 dias via `cleanup_user_presence_heartbeats()` agendada em cron diário (04:17).
- RPC `touch_user_presence_batch(p_user_id, p_client_id, p_slots[])`: insere até N slots arredondados a múltiplos de 30s com ON CONFLICT DO NOTHING. Também atualiza `user_presence`.
- RPC `get_user_online_seconds(user_id, from, to)`: SUM count(*) * 30.
- `useHeartbeat`: captura 1 slot a cada 30s e dá flush a cada 2 min (até 4 slots por chamada). Flush também em focus/online/visibilitychange/pagehide/beforeunload e ao desmontar. Cap retry de 20 slots.
- `worked_seconds` em `useTeamPerformance` vem dos heartbeats (não mais de login/logout). `sessions_count` ainda vem da MV de login.
- `useUserSessions` agrupa slots consecutivos com gap ≤ 120s como uma única sessão (login_at = primeiro slot, logout_at = último slot + 30s, open = se último slot ≤ 2min atrás).
- `useUserAuthEvents` expõe os eventos brutos de login/logout para auditoria (aba secundária no UserSessionsDialog).

**Escala (regra a aplicar):** Com 500 usuários simultâneos o custo é trivial (~17 inserts/s, ~480k linhas/dia). **Acima de 1000 usuários simultâneos**, trocar o flush para uma janela maior (60s) ou ativar batching de **2 min com 4 slots por chamada** (já implementado por padrão) reduz inserts em 4×. Se passar de 5000 usuários, aumentar o intervalo de captura para 60s e considerar particionamento diário.