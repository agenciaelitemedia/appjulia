## Ajustes no Dashboard de Equipe

### 1. Renomear cards de resumo
Em `src/pages/equipe/components/EquipeDashboardTab.tsx`:
- Card "Chats abertos" → **"Chats Atribuídos"** (mantém regra: status `pending` + `open`)
- Card "Cards CRM" → **"CRM Atribuídos"** (mantém regra: exceto `won`/`lost`)
- Cards "Online" e "Tarefas abertas" permanecem.

A lógica em `useTeamDashboardMetrics` já filtra apenas itens em aberto — sem mudança de query.

### 2. Nova linha de gráficos (abaixo dos cards, acima da tabela)

Grid `grid-cols-1 lg:grid-cols-2 gap-3` com dois gráficos:

#### Gráfico A — Tempo Online por usuário (últimos 7 dias)
- Componente novo: `src/pages/equipe/components/TeamOnlineTimeChart.tsx`
- Hook novo: `src/hooks/useTeamOnlineTimeWeek.ts`
- Fonte: `user_activity_log` (eventos `login`, `logout_manual`, `logout_inactivity`) dos últimos 7 dias.
- Cálculo client-side: parear cada `login` com o próximo evento de logout do mesmo `user_id`; se ainda online, usar `now()`. Somar duração por usuário.
- Visual: gráfico de barras horizontais (Recharts) com horas totais por membro, ordenado desc. Tooltip com `Xh Ymin`.

#### Gráfico B — Heatmap de Presença (Dia × Hora, últimos 7 dias)
- Componente novo: `src/pages/equipe/components/TeamPresenceHeatmap.tsx`
- Mesma fonte (`user_activity_log` 7d) + mesmo pareamento de sessões.
- Para cada sessão, marcar todas as células `(dia_da_semana, hora)` cobertas, somando minutos de presença da equipe.
- Visual reutiliza padrão de `src/components/chat/analytics/ChatHeatmap.tsx` (matriz 7×24 com gradiente do `--primary`), adaptado para mostrar minutos totais e tooltip "Seg 14h — N min de presença / M usuários".
- Mostra picos de horário em que a equipe está mais ativa.

### 3. Sugestões adicionais (não implementar agora, apenas registrado)
- Indicador "tempo médio de sessão" e "logouts por inatividade" como microcards extras, caso queira depois.

### Detalhes técnicos
- Nenhuma mudança de schema/RLS — `user_activity_log` e a view `user_last_activity` já existem.
- Hook `useTeamOnlineTimeWeek` faz UMA query: `select user_id, event_type, created_at from user_activity_log where created_at >= now() - 7d and user_id in (...)` ordenado por `user_id, created_at`. Pareamento de sessões em memória, alimentando ambos os gráficos via `useMemo` separados (ou um único hook que retorna `{ perUser, heatmap }`).
- Realtime: invalidate na tabela `user_activity_log` (já existe pattern em `useTeamLastActivity`).

### Arquivos
- Editar: `src/pages/equipe/components/EquipeDashboardTab.tsx`
- Criar: `src/hooks/useTeamWeeklyActivity.ts` (retorna `{ onlineSecondsByUser, heatmapMatrix }`)
- Criar: `src/pages/equipe/components/TeamOnlineTimeChart.tsx`
- Criar: `src/pages/equipe/components/TeamPresenceHeatmap.tsx`