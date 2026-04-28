# Melhorias na cena de Infra + ticker estilo bolsa

Três entregas independentes no painel `/tv/master`:

## 1. Filtros de origem na cena Infra

Adicionar barra de chips no topo da `SceneInfraCloud` para escolher quais sources de webhook entram nas métricas dos KPIs (Total 24h, Última hora, Encaminhados) e no ranking.

- Lista dinâmica: extraída do próprio resultado de `useWebhookActivity` (todas as `source` distintas das últimas 24h).
- Estado: `useState<Set<string>>` na cena, persistido em `localStorage` (`tv:infra:source-filter`) para sobreviver a recargas/rotação.
- Comportamento: se nenhum chip ativo → mostra todos (default). Cada chip clicável alterna inclusão. Botão "Todos" e "Limpar".
- O hook `useWebhookActivity` passa a retornar a lista bruta (`raw: { source, created_at, forwarded }[]`) além dos agregados; a cena recalcula os totais filtrados via `useMemo` para evitar refetch.

Visual: chips compactos no canto superior direito do `TvCard "Webhooks recebidos"`, estilo `bg-zinc-800 text-xs`, ativos em `bg-violet-500/20 ring-1 ring-violet-400`.

## 2. Histórico em série temporal (60min)

Novo widget na cena Infra: `TvCard "Evolução 60min"` ocupando a linha inferior (col-span-12), com 3 sparklines lado a lado:

- **Conexões ativas** (do banco)
- **Webhooks/min** (volume agregado)
- **Mídia/min** (chat_messages com `media_url`)

Implementação:

- Novo hook `useInfraTimeSeries()` que mantém um buffer in-memory de até 60 pontos (1 ponto por minuto). Cada minuto, ao receber novo dado de `useInfraStats` / `useWebhookActivity` / `useMediaStats`, faz `push` no buffer e descarta os pontos > 60min. Buffer guardado em `useRef` + `useState` para forçar re-render.
- Persistência leve em `sessionStorage` (`tv:infra:timeseries`) para que rotacionar entre cenas não perca o histórico já coletado.
- Renderização com `recharts` (`AreaChart` minimalista, sem eixos, similar ao `DashboardSparkline.tsx` que já existe), em 3 cards lado a lado mostrando:
  - Valor atual grande (tabular-nums)
  - Min / Max do período
  - Sparkline com gradiente

Tons: cores consistentes com o resto da cena (azul para conexões, violeta para webhooks, âmbar para mídia).

## 3. Ticker estilo bolsa de valores

Reformatar `TvTicker.tsx` para visual de cotação financeira:

- Fundo preto puro (`bg-black`), borda superior/inferior fina dourada (`border-y border-amber-500/40`).
- Cada item formatado como ticker bursátil:
  ```
  SLA ▲ 12 ATRASOS  +3   |   DISPATCHER ● ONLINE  42s   |   CHURN ▼ 5 SINAIS  -2
  ```
- Layout por item: `[CÓDIGO em mono uppercase] [seta ▲▼●] [valor] [delta colorido]`.
  - ▲ verde para alta positiva (mais leads, mais conversões), ▼ vermelho para queda, ● âmbar para neutro/status.
  - Para alertas (SLA violado, churn, dispatcher offline) inverter: ▲ em vermelho = ruim subindo.
- Separadores: `│` em `text-amber-500/30` entre tickers.
- Tipografia: `font-mono uppercase tracking-wider text-base`, alturas reduzidas (py-2).
- Manter marquee animation existente (60s loop, pausa no hover).
- Tickers serão derivados das mesmas fontes (`useGlobalSlaStats`, `useChurnSignals`, `useDispatcherHealth`) mais 2 novos snapshots para enriquecer:
  - `WEBHOOKS` — total última hora (vem de `useWebhookActivity`)
  - `DB` — conexões ativas (vem de `useInfraStats`)
- Delta calculado comparando com snapshot da consulta anterior guardado em `useRef`.

## Arquivos

**Editar**
- `src/pages/tv/hooks/useInfraStats.ts` — `useWebhookActivity` retorna também lista bruta; novo hook `useInfraTimeSeries`.
- `src/pages/tv/components/scenes/SceneInfraCloud.tsx` — chips de filtro, recálculo via memo, nova linha com 3 sparklines.
- `src/pages/tv/components/TvTicker.tsx` — refatoração visual completa estilo bolsa, integração com webhooks/db.

**Criar**
- `src/pages/tv/components/widgets/TvSparklineCard.tsx` — card reutilizável (label + valor + min/max + sparkline recharts).
- `src/pages/tv/components/widgets/TvTickerItem.tsx` — item formatado código/seta/valor/delta.

## Tratamento de falhas

- Buffer de série temporal começa vazio na primeira carga; sparkline mostra placeholder "coletando…" até ter ≥ 2 pontos.
- Filtro de origem que não retorna nada exibe "—" nos KPIs em vez de quebrar.
- Ticker continua funcionando mesmo se webhooks/db falharem (apenas omite o tile correspondente).
