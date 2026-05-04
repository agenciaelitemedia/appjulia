## Objetivo

Reescrever `/admin/operacoes` como um **War Room** otimizado para TV 55" 4K (3840×2160), exibindo **apenas sinais críticos** que exigem ação imediata. Sem scroll, sem decoração, sem texto pequeno — leitura a 3-4m de distância.

## Princípios de design (TV 55" 4K)

- **Sem scroll vertical**: tudo cabe em 1 viewport (~2160px de altura útil).
- **Tipografia gigante**: KPIs `text-7xl/8xl` (96-128px). Labels `text-xl`. Nada abaixo de `text-base`.
- **Semáforo dominante**: cores primárias para estado (verde / amarelo / vermelho). Cinza só em fundo.
- **Densidade controlada**: 8-10 painéis no máximo, organizados em grid simétrico.
- **Auto-refresh agressivo** (10-30s) já existe nos hooks, manter.
- **Modo "alarme"**: itens críticos com pulse + cor sólida (vermelho saturado).

## Layout proposto (grid 12 colunas, sem scroll)

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  HEADER: JULIA OPS  ·  HH:MM:SS  ·  Última sync: 5s atrás  ·  [● LIVE]   │  ~80px
├────────────────────┬────────────────────┬─────────────────┬──────────────┤
│  CANAIS            │  ATENDIMENTO       │  IA / CLASSIF   │  INFRA       │
│  (semáforo grande) │  PEND / TME / SLA  │  Confiança      │  DB · Disp.  │
│                    │                    │                 │              │  ~520px
├────────────────────┴────────────────────┴─────────────────┴──────────────┤
│  ALERTAS ATIVOS (faixa horizontal scroll auto, vermelho/âmbar)          │  ~120px
├────────────────────┬────────────────────┬───────────────────────────────┤
│  WEBHOOK QUEUE     │  AUTOMAÇÕES        │  CAPACIDADE DOS AGENTES        │
│  pend / fail big   │  taxa sucesso      │  barras + % ocupação           │  ~520px
└────────────────────┴────────────────────┴───────────────────────────────┘
                              TICKER bottom: últimas falhas (rolagem)        ~80px
```

## Conteúdo de cada bloco

### 1. CANAIS (vital)
- Número GIGANTE: `X/Y conectados` (verde se 100%, vermelho se algum off).
- Lista compacta apenas de **filas com problema** (verdes ficam só como contador).

### 2. ATENDIMENTO HUMANO
- 3 KPIs grandes: **Pendentes**, **TME 1ª resposta**, **SLA %**.
- Cores: pendentes >20 → vermelho; SLA <80% → vermelho; TME >5min → âmbar.

### 3. IA / CLASSIFICAÇÕES
- KPI grande: **Confiança média %** (vermelho <70, âmbar <85).
- Contador **Urgentes 24h** (laranja se >0).
- Mini barra sentimento (positivo/neutro/negativo/frustrado).

### 4. INFRAESTRUTURA
- Status **Dispatcher** (Online/Lento/Offline) — pulse vermelho se offline.
- **Conexões DB ativas** (vermelho >80).
- **Query mais lenta** (alerta se >30s).
- Workers `X/Y`, items/min.

### 5. WEBHOOK QUEUE
- KPI gigante de **Falhas** (vermelho se >0).
- Pendentes (âmbar se >50).
- Max retries badge se >3.

### 6. AUTOMAÇÕES & BOTS
- **Taxa de falha %** big (vermelho >5%).
- Execuções 24h e taxa de conclusão de bots.

### 7. CAPACIDADE DOS AGENTES
- Lista de agentes com barras de ocupação. Apenas mostra os com >70% de uso (foco no risco).
- Badge "SOBRECARGA" pulsante se ≥90%.

### 8. ALERTAS ATIVOS (faixa horizontal, abaixo do row 1)
Consolida sinais críticos derivados (já calculados em hooks):
- "Dispatcher offline há Xs"
- "N webhooks falhando"
- "Fila X desconectada há Y min"
- "Confiança IA caiu para X%"
- "Agente Y sobrecarregado"

Cards vermelhos/âmbar em rolagem horizontal automática (CSS `animate-marquee`) se houver muitos.

### 9. TICKER inferior
Rolagem horizontal contínua das últimas 10 falhas (webhooks + automações), formato compacto: `[14:32] WhatsApp UaZapi · timeout (3 tent.)`.

## Implementação

### Arquivos a criar
- `src/pages/admin/operacoes/components/WarRoomHeader.tsx` — relógio + heartbeat live.
- `src/pages/admin/operacoes/components/CriticalAlerts.tsx` — faixa de alertas derivados.
- `src/pages/admin/operacoes/components/AlertTicker.tsx` — rolagem inferior.
- `src/pages/admin/operacoes/components/BigPanel.tsx` — wrapper padrão de painel TV (header + KPI gigante + footer compacto).
- `src/pages/admin/operacoes/components/panels/CanaisPanel.tsx`
- `src/pages/admin/operacoes/components/panels/AtendimentoPanel.tsx`
- `src/pages/admin/operacoes/components/panels/IAPanel.tsx`
- `src/pages/admin/operacoes/components/panels/InfraPanel.tsx`
- `src/pages/admin/operacoes/components/panels/WebhookPanel.tsx`
- `src/pages/admin/operacoes/components/panels/AutomacoesPanel.tsx`
- `src/pages/admin/operacoes/components/panels/CapacidadePanel.tsx`
- `src/pages/admin/operacoes/hooks/useCriticalAlerts.ts` — agrega todos os hooks existentes e devolve uma lista priorizada de alertas (severity: critical/warn/info).

### Arquivo a reescrever
- `src/pages/admin/operacoes/OperacoesMonitorPage.tsx` — layout grid 12 col, fundo escuro (`bg-zinc-950`), sem padding lateral, ocupando `h-screen`. Renderiza header + 4 painéis topo + faixa alertas + 3 painéis baixo + ticker.

### Reuso (sem mudanças)
- Todos os hooks de dados em `useOperacoesData.ts`, `useInfraStats`, `useDispatcherHealth`, `useAttendanceKpis`, `useAgentLoads` permanecem como única fonte de verdade.

### Layout fora do MainLayout
A página vai usar `h-screen w-screen overflow-hidden` com fundo próprio. Como já é renderizada dentro do `MainLayout` (sidebar + header), vou aplicar `fixed inset-0 z-50 bg-zinc-950` na raiz para sobrepor o shell e ficar fullscreen real quando aberta numa TV. (Sai com botão ESC/X discreto no canto.)

### Tema
Tokens semânticos: usar `destructive`, `primary`, `muted-foreground` etc. Cores específicas para semáforo (verde/âmbar/vermelho) virão de `tailwind.config.ts` HSL — sem hardcode hex/white nos componentes.

## O que sai da tela atual
- Lista detalhada de falhas (vai pro ticker rolando).
- Modelos de IA usados (informativo, não crítico).
- Lista completa de filas conectadas (substituída por contador).
- Sentimento detalhado (vira mini-barra).

## Resultado
Uma tela fullscreen que, a 4 metros de distância, deixa óbvio em <2 segundos: **está tudo verde** ou **onde está o fogo**.