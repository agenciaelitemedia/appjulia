## Objetivo

Mostrar, na aba **Performance** de `/equipe`, o **período de trabalho real** de cada membro no dia (com base nos heartbeats de presença) e os indicadores de **atraso** e **saída antecipada** em relação a um horário de referência opcional — sem precisar cadastrar escala por usuário.

## Como vamos medir (sem escala fixa)

A definição de "horário trabalhado" sai diretamente dos logs já existentes em `user_presence_heartbeats`:

- **Início do expediente (dia D)** = primeiro heartbeat do usuário em D (BRT).
- **Fim do expediente (dia D)** = último heartbeat do usuário em D (BRT) + 30s (granularidade do slot).
- **Janela bruta** = `fim - início` (inclui pausas).
- **Tempo efetivo online** = continua vindo de `get_team_online_seconds_by_day` (já calcula slots únicos).
- **Pausas** = `janela bruta - tempo efetivo` (almoço, ausências, etc.).

Para **atraso / saída antecipada** precisamos de um horário-alvo. Como você não quer cadastrar escala por pessoa, usamos um **horário de referência único do cliente** (ex.: 09:00–18:00) já disponível em `chat_client_settings.settings.BUSINESS_HOURS_SCHEDULE` (lib `businessHoursUtils`). Se o cliente não tiver Business Hours configurado, esses dois indicadores aparecem como "—".

- **Atraso** = `max(0, primeiro_heartbeat - inicio_previsto_do_dia)`
- **Saída antecipada** = `max(0, fim_previsto_do_dia - ultimo_heartbeat)` (somente se houve trabalho no dia)

## Implementação

### 1. Nova RPC `get_team_work_window_by_day`

Retorna por `(user_id, day_brt)`:
- `first_seen_at`, `last_seen_at` (timestamptz, BRT)
- `span_seconds` (janela bruta)

Consulta `user_presence_heartbeats` (hot) + agregação opcional. Para dias antigos não precisamos de precisão de segundos — usar `min/max(seen_at)` direto na partição mensal já é eficiente (índice BRIN existente).

### 2. Hook `useTeamWorkWindow`

Recebe `userIds`, `from`, `to`. Faz `supabase.rpc('get_team_work_window_by_day', …)` e expõe um mapa `{ [userId]: { firstSeen, lastSeen, span } }` agregado pelo período selecionado (pega `min(first)` e `max(last)` por usuário no range).

### 3. UI em `EquipePerformanceTab.tsx`

Adicionar **3 colunas novas** na tabela "Por atendente":

| Coluna | Conteúdo |
|---|---|
| Período trabalhado | `08:42 → 18:13` (ou "—" se sem dados) |
| Atraso | `+12 min` em vermelho / `No horário` em verde / "—" se sem Business Hours |
| Saída antecipada | `-25 min` em laranja / `Cumpriu` / "—" |

Tooltip na coluna "Período trabalhado" explicando que é `primeiro → último heartbeat do dia` e que pausas não são descontadas.

Adicionar um card-resumo no topo (ao lado dos KPIs atuais): **"Janela média da equipe"** = média de `span_seconds`.

### 4. Detalhe diário (opcional, mesmo PR)

No drawer/expansor do membro (se existir), mostrar uma linha por dia com:
`18/06 · 08:42 → 18:13 · 7h 51min online · atraso +12min`

Reaproveita a RPC já existente `get_user_presence_sessions` para detalhar logins/logouts se o usuário expandir.

## Considerações técnicas

- Performance: a RPC roda `min/max` por `(user_id, day_brt)` em partições mensais com índice `(client_id, seen_at DESC)`. Para 30 dias × 20 usuários custa milissegundos.
- Timezone: tudo convertido para `America/Sao_Paulo` no servidor (igual ao padrão das outras RPCs).
- Sem nova tabela, sem migration de schema fora da função.
- Não altera o cálculo de "Tempo online" atual — apenas adiciona métricas.

## Fora de escopo

- Cadastro de escala individual (turnos, dias da semana por usuário).
- Edição inline do horário-alvo na própria tela (continua vindo do Business Hours global).
- Exportação CSV das novas colunas (pode ser próximo passo se quiser).
