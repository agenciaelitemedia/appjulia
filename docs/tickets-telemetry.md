# Tickets, Telemetria, Notificações

## 1. Tickets/Helpdesk

Módulo `/tickets` — chamados de suporte Julia→escritórios (papéis: `requester`/`manager`/`agent` via `useTicketRole`). Ver histórico completo de design em conversas anteriores; abaixo o estado atual do schema/regras.

**Tabelas**: `support_tickets`, `support_ticket_messages`, `support_departments`, `support_categories`, `support_settings`, `support_ticket_counters`, `support_protocol_counters`.

**`support_tickets`**: status (`open|pending|in_progress|waiting_customer|resolved|closed`), priority, `department_id`, `category_id`, `requester_*`, `requester_client_id`, `assigned_to(_name)`, `conversation_id` (vínculo opcional com chat), `contact_id`, `protocol` (numeração amigável), `number`, `opened_at`, `first_response_at`, `resolved_at`, `closed_at`, `reopened_count`, `sla_first_response_due_at`, `sla_resolution_due_at`, `csat_score/comment/at`.

**Escopo por papel** (`useTickets.ts`): `requester` → `requester_user_id=me`; `manager`/membros de equipe → `requester_client_id` via `resolveEffectiveClientId`; `agent` (admin) → todos. Lista padrão exclui `status='closed'`.

**Regras de negócio**:
- Auto-assign de ticket ao primeiro responsável que interage.
- Protocolo gerado via sequence/counter.
- SLA calculado por `department`/prioridade nas `support_settings` (first_response/resolution).
- `dispatchToWhatsApp()`: ao responder um ticket vinculado a uma conversa, a mensagem pode ser despachada de volta pro WhatsApp via `queues` (uazapi/waba) — resolve fila, contato e envia.
- CSAT ao resolver.
- Notas internas (`support_ticket_messages`) não visíveis ao requester.
- Timeline/eventos junto com mensagens.
- Mídia: `ticket-media-upload`.
- Herança: criar ticket a partir de conversa herda `conversation_id`/`contact_id`; ao trocar de conversa no chat, ticket ativo pode ser fechado automaticamente (`b37067bc "Fechei o ticket ao trocar de conversa"`).

**Telas**: `TicketsPage.tsx` (Lista/Kanban/Dashboard/Settings por papel, view persistida em `localStorage tickets:lastView`), `TicketDetailPage.tsx`, `TicketsKanban.tsx` (dnd-kit, cards por status coloridos), `TicketsListTab.tsx`, `SupportSettingsTab.tsx` (departamentos/categorias/SLA/CSAT), `TicketSlaBadge.tsx`. Integração no chat: `ChatTicketSidePanel.tsx`/`ChatTicketDetailSidePanel.tsx` (ver [docs/chat.md](chat.md#6-vínculo-chat--ticket)).

## 2. Telemetria

Captura ambiente (navegador/SO/hardware/rede) e performance (Web Vitals) do usuário. Objetivo: diagnosticar lentidão sem depender de dados exatos de hardware (que o browser não expõe).

### Tabelas
- **`user_device_log`** (snapshot por login/sessão): `user_id, user_name, client_id, occurred_at, browser(_version), os(_version), device_type, cpu_cores, device_memory_gb, gpu_renderer, screen_w/h, dpr, viewport_w/h, net_effective_type, net_downlink_mbps, net_rtt_ms, save_data, language, timezone, user_agent`.
- **`user_performance_log`** (por carregamento/rota): `user_id, client_id, occurred_at, route, ttfb_ms, fcp_ms, lcp_ms, cls, dom_interactive_ms, load_ms, js_heap_used_mb, net_effective_type`.
- **View `user_device_latest`**: `DISTINCT ON (user_id) ... ORDER BY user_id, occurred_at DESC` — snapshot mais recente por usuário.
- **`user_activity_log`** (tabela separada, pré-existente): audit trail de login/logout (`event_type: login|logout_manual|logout_inactivity`), com view `user_last_activity`. **Não** é telemetria de device/perf.

RLS permissiva (`USING(true) WITH CHECK(true)`); ambas as tabelas de telemetria na publicação Realtime.

### O que é capturado
**Ambiente** (`src/lib/clientEnvironment.ts`, `collectClientEnvironment()`): navegador/versão e SO via **User-Agent Client Hints** (`navigator.userAgentData.getHighEntropyValues`) com fallback de parse do UA-string; `device_type` (desktop/mobile/tablet); `cpu_cores` = `navigator.hardwareConcurrency`; `device_memory_gb` = `navigator.deviceMemory`; GPU via WebGL `UNMASKED_RENDERER_WEBGL`; tela/viewport/dpr; rede via `navigator.connection` (effectiveType/downlink/rtt/saveData); idioma/fuso via `Intl`. Tudo `null` se não suportado (ex.: `deviceMemory`/`connection` são Chromium-only).

**Performance** (`src/lib/clientPerformance.ts`): `startPerformanceObservers()` registra `PerformanceObserver` para LCP (`largest-contentful-paint`) e CLS (`layout-shift`, ignora `hadRecentInput`) uma única vez. `collectPagePerformance()` lê Navigation Timing (`TTFB=responseStart`, `domInteractive`, `loadEventEnd`), Paint Timing (`FCP`), heap JS (`performance.memory.usedJSHeapSize`, Chromium-only).

### Coleta (quando/onde)
- Ambiente: no `login()` (`AuthContext.tsx`) e no restore de sessão já logada (guardado por `sessionStorage` flag para rodar 1x por sessão de browser). Não-bloqueante, falha silenciosa.
- Performance: `usePerformanceReporter()` (`src/hooks/usePerformanceReporter.ts`), montado uma vez em `MainLayout.tsx`. Reporta 2.5s após cada navegação de rota + no `visibilitychange:hidden` (captura LCP/CLS final). Throttle: máx 1 envio/60s por usuário. Só com usuário logado.

### Edge function `telemetry` (`supabase/functions/telemetry/index.ts`)
Actions: `log_device`, `log_performance` (INSERT simples), `get_device_latest` (por lista de userIds), `get_user_performance` (últimas 100 amostras de 1 usuário), `get_users_with_telemetry` (lista com último `occurred_at`), **`get_dashboard`** (agregador pesado):
- Recebe `fromISO`/`bucketMs`. Busca até 20.000 linhas de `user_performance_log` no período + conta sessões (`user_device_log`) + carrega toda `user_device_latest` (composição da frota).
- Calcula: `kpis` (activeNow=usuários c/ amostra nos últimos 5min, sessions, samples, lcpP75/Avg, loadP75/Avg, ttfbAvg, goodRate=%LCP≤2500, weakCount, avgDownlink, avgRtt, avgHeap), `timeseries` (por bucket), `byBrowser/byOs/byDevice/byNetwork` (tallies), `vitals` (good/ni/poor por faixa LCP: ≤2500/2500-4000/>4000), `slowRoutes` (top 8 por LCP médio), `byClient` (top 8 piores client_id por LCP p75 + contagem de dispositivos fracos), `recentSlow` (últimas 12 amostras com LCP>2500).
- Heurística "dispositivo fraco" (`isWeak`): `cpu_cores≤2` OU `device_memory_gb≤2` OU `net_effective_type` em `slow-2g/2g/3g`.

### Dashboard modo TV — `TelemetryDashboard.tsx`
Em `/admin/monitoramento` → aba "Ambiente & Performance" → sub-aba "Dashboard". Reusa widgets de TV (`BigKpiCard`, `TvCard`, `TvSparklineCard`, `BarRanking` de `src/pages/tv/components/widgets/`). Recursos:
- **Fullscreen** (Fullscreen API nativa) — em fullscreen, tipografia/padding aumentam.
- **Auto-refresh** 10s quando "AO VIVO" ligado (`refetchInterval`); pausável.
- **Seletor de período**: 15m/1h/24h/7d/30d, cada um com seu `bucketMs`.
- KPIs, série temporal (LCP p75 + carga), sparklines, volume de amostras, Core Web Vitals (barra good/NI/poor), saúde de rede, 4 donuts (navegador/SO/dispositivo/rede), rankings (rotas lentas, piores escritórios), tabela de sessões lentas recentes.

Sub-aba "Dados" (`TelemetryExplorer.tsx`): lista de usuários com telemetria (`get_users_with_telemetry`, tempo relativo pt-BR), detalhe por usuário (`get_device_latest` + `get_user_performance` com médias e amostras recentes), aviso de dispositivo fraco.

## 3. Notificações

- **"Notificar Clientes"** (`/notificar-clientes`, módulo `notify_customers`): notificações internas em tempo real para usuários do sistema.
- `internal_notifications`/`_recipients` (Supabase), edge functions `internal-notification-scheduler`/`internal-notification-dispatch`.
- **Push**: `push_notifications`/`push_subscriptions`, edge function `send-push` (Web Push).
- `NotificationCenter` (componente de UI, sino de notificações).
