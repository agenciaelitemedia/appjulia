# Dashboard de Performance da Equipe

Nova aba **"Performance"** dentro de `/equipe` (ao lado de Dashboard e Gestão de Equipe). Acesso herdado da permissão do módulo `team` (sem alterações). Filtros: período (Hoje, Ontem, 7d, Mês atual, Mês anterior, Personalizado) + multi-select de usuários da equipe.

## Dados que vamos consolidar (por user × dia)

**1. Tempo de trabalho** — `user_activity_log` (`login`, `logout_manual`, `logout_inactivity`) + cap em `user_presence.last_seen_at` para sessões abertas.
- `worked_seconds`, `sessions_count`, `first_login`, `last_logout`, `idle_seconds` (gaps > 15 min entre eventos dentro da sessão).

**2. Atendimentos** — `chat_conversations` + `chat_conversation_history`.
- `received` (eventos `assigned` para o user, ou `opened_at` quando atribuído na criação)
- `resolved`, `returned_to_queue` (inclui `auto_returned`), `transferred` (assigned com `from_value`=user e `to_value`=outro user)
- `handle_seconds` por conversa = saída − assigned; agregados `avg`, `p50`, `p95`
- `first_response_seconds_avg` (`first_response_at − opened_at`)

**3. Telefonia** — `phone_call_logs`.
- `calls_total`, `calls_answered`, `calls_outbound`, `calls_inbound`
- `talk_seconds`, `avg_call_seconds`
- `unique_numbers`, top 20 `(called_normalized, count, total_seconds)`
- `calls_to_known_leads` = cruzamento de `called` normalizado com `chat_contacts.phone` do mesmo `client_id`

**4. Derivadas** — `occupancy_pct`, `conversations_per_hour`, `resolution_rate`, `return_rate`, `talk_ratio`.

## Camada SQL (materialized views)

```text
v_user_sessions_daily   (user_activity_log + user_presence)
v_user_chat_daily       (chat_conversations + chat_conversation_history)
v_user_phone_daily      (phone_call_logs + chat_contacts p/ leads)
v_user_phone_top_numbers (top 20 números por user × dia)
v_user_performance_daily (join final dos 3 acima)
```

- Particionadas conceitualmente por `(client_id, day_brt, user_id)` em America/Sao_Paulo.
- Índice único `(client_id, day_brt, user_id)` em cada MV → permite `REFRESH ... CONCURRENTLY`.
- `pg_cron` a cada **5 min** para refresh.
- View regular `v_user_performance_today` lendo dados ao vivo para o dia corrente (UNION no hook quando o range inclui hoje), assim "Hoje" é tempo real e histórico é instantâneo.
- Cuidado memória do projeto: cast `bigint` em `cod_agent` / `client_id` ao cruzar fontes.

## UI — aba "Performance" em `/equipe`

### Cabeçalho de filtros (sticky)
- Seletor de período (chips) + date range custom
- Multi-select de usuários (reusa `AgentMultiSelectPopover` adaptado para members da equipe)
- Botão Exportar (CSV + PDF, padrão `ChatReportsPage`)

### Linha 1 — KPIs agregados (8 cards compactos com sparkline 14d)
| KPI | Visual |
|---|---|
| Tempo total logado | Card + sparkline |
| Atendimentos recebidos | Card + sparkline |
| Taxa de resolução | Card + gauge radial |
| Tempo médio de atendimento | Card + sparkline |
| Devoluções p/ fila | Card + delta vs período anterior |
| Transferências | Card + delta |
| Ligações realizadas | Card + sparkline |
| Talk time total | Card + sparkline |

### Linha 2 — Gráficos
- **Stacked Bar diário** (recharts BarChart): por dia, barras empilhadas `Resolvidas / Devolvidas / Transferidas / Em aberto`. Eixo Y secundário com linha de "Tempo logado (h)".
- **Heatmap dia da semana × hora** (grid customizado): densidade de mensagens enviadas pelo user → mostra "horários produtivos" da equipe.
- **Funil de atendimento** (recharts FunnelChart): Recebidas → Respondidas (1ª resposta) → Resolvidas.
- **Scatter "Ocupação × Resolução"**: cada ponto = um atendente no período; X = ocupação %, Y = taxa de resolução, tamanho = volume. Identifica top performers e ociosos em um olhar.

### Linha 3 — Ranking por atendente (tabela principal)
Tabela ordenável com todas as colunas-chave, mini-barras inline para comparação visual:

| Atendente | Tempo logado | Ocupação | Receb. | Resolv. | Devol. | Transf. | TMA | 1ª resp | Ligações | Talk time | Leads chamados |
|---|---|---|---|---|---|---|---|---|---|---|---|

- Linha clicável → abre **Drawer lateral** com:
  - **Timeline do dia** (lane chart): sessões (verde), conversas em atendimento (azul), chamadas (laranja) — visualiza sobreposição
  - **Top 20 números chamados** (tabela)
  - **Lista de conversas** do período com status final, duração e link p/ chat
  - **Pie**: distribuição do tempo (talk / handle / idle)

### Linha 4 — Telefonia detalhada (colapsável)
- **Tabela "Top números mais chamados"** consolidada (com flag "é lead?", contagem, talk time)
- **Bar horizontal** top 10 atendentes por talk time
- **Line chart** chamadas por hora do dia (média do período)

## Critérios e cuidados

- **Fuso** America/Sao_Paulo em todas agregações
- **Sessão sem logout**: cap em `last_seen_at + 5min`
- **Transferência**: só conta quando origem E destino são users (atribuição inicial da fila não conta)
- **Normalização de telefone**: `phoneNormalize.ts` existente (mesma lógica do CRM)
- **Performance**: MVs com `CONCURRENTLY`, hook usa MV para histórico + view ao vivo para hoje
- **Filtro por user**: aplicado no client após query (resultset já pequeno por estar pré-agregado)
- **Acesso**: aba renderiza dentro de `/equipe`, herda guard de `team` — sem mudança em permissões

## Entregáveis

1. Migration: 5 MVs + 1 view "hoje" + índices únicos + cron de 5min
2. Hook `useTeamPerformance(filters, userIds)` e `useTeamPerformanceDetail(userId, dateRange)`
3. Novo arquivo `src/pages/equipe/components/EquipePerformanceTab.tsx`
4. Subcomponentes: `PerformanceKpis`, `PerformanceDailyChart`, `PerformanceHeatmap`, `PerformanceFunnel`, `PerformanceScatter`, `PerformanceRankingTable`, `PerformanceUserDrawer`, `PerformancePhoneSection`
5. Atualizar `EquipePage.tsx` para incluir a 3ª aba

## Perguntas finais

1. **"Conversa recebida"** = data de **atribuição ao user** (recomendado, reflete carga real) ou data de **criação da conversa**?
2. **"Ligou para o lead"** = contato em `chat_contacts` do cliente, ou também `crm_deals` (lead do CRM)?
3. **Heatmap de produtividade** deve contar **mensagens enviadas** pelo user ou **conversas ativas** por hora?
