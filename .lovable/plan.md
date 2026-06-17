## Backfill aproximado dos heartbeats a partir do histórico de login/logout

Há ~33 dias de histórico em `user_activity_log` (2.907 logins / 2.768 logouts de 102 usuários). Vamos gerar **slots sintéticos de 30 s** entre cada par login → logout, gravar em `user_presence_heartbeats` e consolidar em `user_presence_daily` para que o dashboard mostre histórico imediatamente. A partir de amanhã o tempo é 100% real.

### Regras do backfill

- **Pares são montados varrendo os eventos por usuário em ordem cronológica**, igual à lógica antiga do `useUserSessions`. Login sem logout pareado é descartado (a antiga UI usava cap de 12h e isso era a fonte do "9h46" — não vamos repetir).
- **Cap por sessão: 8 h** (mais conservador que os 12 h antigos). Sessões maiores são truncadas no logout virtual (login + 8 h).
- **Logout sem login pareado** é descartado.
- **Tudo é arredondado a múltiplos de 30 s** (slot canônico), `ON CONFLICT DO NOTHING` para não duplicar com heartbeats reais já existentes.
- **Janela: últimos 90 dias** (limite de retenção dos heartbeats brutos). As partições mensais já existem para o período.
- **Marcação**: dados gerados desta forma ficam em `user_presence_heartbeats` normais (não há flag `synthetic`). Para a UI saber, exposição via `user_presence_daily.metadata` (jsonb) opcional **não** será adicionada — em vez disso, marcamos no front a partir de uma data-limite gravada em `chat_client_settings.settings.presence_backfill_until` (texto YYYY-MM-DD).

### Passos

1. **Migration: função SQL `backfill_user_presence_heartbeats(p_from timestamptz, p_to timestamptz, p_cap_seconds int default 28800)`**
   - Varre `user_activity_log` no intervalo, monta pares por usuário com window functions (`LAG`/state machine via subquery ordenada).
   - Para cada par válido `(login_at, logout_at, user_id, client_id)`:
     - Trunca a duração ao cap.
     - Gera série `generate_series(slot_start, slot_end, '30 seconds')` e insere em `user_presence_heartbeats` com `ON CONFLICT DO NOTHING`.
   - Retorna jsonb `{ pairs, slots_inserted, users }`.
   - `SECURITY DEFINER`, grant a `service_role` apenas.

2. **Executar o backfill via `supabase--insert`**
   - `SELECT public.backfill_user_presence_heartbeats(now() - interval '90 days', now())`.
   - Em seguida, consolidar todos os dias afetados em `user_presence_daily`:
     ```sql
     SELECT public.rollup_user_presence_daily(d::date)
       FROM generate_series((now() - interval '90 days')::date,
                            (now() AT TIME ZONE 'America/Sao_Paulo')::date - 1,
                            interval '1 day') d;
     ```

3. **Marcar a data-limite "estimado" em settings (opcional)**
   - `UPDATE chat_client_settings SET settings = settings || jsonb_build_object('presence_backfill_until', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD'))`.
   - Frontend lê e exibe selo "estimado (login/logout)" em dias `<= presence_backfill_until` no card "Tempo online", na coluna da tabela e no modal de sessões.

4. **Frontend (mínimo, complementa o plano anterior):**
   - `useTeamPerformance`: ler `presence_backfill_until` do cliente (1 chamada extra cacheada). Adicionar no tooltip do KPI: *"Dias até DD/MM/YYYY são estimados a partir de pares login/logout (cap 8h). Do dia seguinte em diante, medição real por heartbeats."*
   - `UserSessionsDialog`: badge "Estimado" (cinza) em linhas cujo `login_at <= presence_backfill_until`.

### Estimativa de volume

~5.500 pares × média 2 h cada = ~5.500 × 240 slots ≈ **1,3 M linhas inseridas** distribuídas em 2 partições mensais (maio/2026 e junho/2026). Custo: ~1–2 min de execução, ~40 MB de tabela. Sem impacto em produção (inserts puros, `ON CONFLICT DO NOTHING`).

### O que NÃO vai ser feito

- Não vamos sintetizar atividade fora dos pares login/logout (ex.: aba aberta sem login registrado).
- Não vamos rodar o backfill em cron — é one-shot.
- Não vamos modificar `mv_user_sessions_daily`.
- Não vamos remover o card de sessões antigo nem mudar a UI além dos selos "estimado".

### Arquivos / objetos afetados

- **Migration** (nova função): `public.backfill_user_presence_heartbeats(timestamptz, timestamptz, int)`.
- **Dados**: inserts em `user_presence_heartbeats` e `user_presence_daily` (via rollup), update em `chat_client_settings`.
- **Frontend**: `useTeamPerformance.ts` (carregar `presence_backfill_until`), `EquipePerformanceTab.tsx` e `EquipePerformanceDrawer.tsx` (tooltips), `UserSessionsDialog.tsx` (badge "Estimado").
