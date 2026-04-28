# Nova cena no painel TV: Infraestrutura & Cloud

Hoje `/tv/master` rotaciona 3 cenas a cada 30s (Atendimento, Saúde Técnica, Clientes). Vou adicionar uma **4ª cena** focada em infra/cloud, que entra automaticamente no rodízio.

## O que a cena vai mostrar

Layout grid 12 colunas, mesmo padrão visual das outras cenas (TvCard / BigKpiCard / BarRanking).

**Linha 1 — Big KPIs (status do backend Lovable Cloud)**
- Status da instância Cloud (`ACTIVE_HEALTHY` / `COMING_UP` / `UNHEALTHY` etc.) com semáforo verde/âmbar/vermelho
- Latência média do banco (ms) — última hora
- Erros 5xx em Edge Functions — últimas 24h
- Uptime % nas últimas 24h (derivado de heartbeat do dispatcher + ausência de erros 5xx)

**Linha 2 — Edge Functions**
- TvCard "Top Edge Functions por volume (24h)" — ranking com chamadas, p95 latência e % de erro por função (a partir dos `function_edge_logs`)
- TvCard "Erros recentes" — últimos 8 eventos de erro de edge functions com timestamp, função e código de status

**Linha 3 — Banco & Storage**
- TvCard "Banco de dados" — tamanho total, conexões ativas, slow queries (> 1s) na última hora
- TvCard "Storage / Mídia" — total de objetos, tamanho usado, uploads nas últimas 24h (tabela `chat_messages` com `media_url` ou bucket de storage)

## Como buscar os dados

Tudo já está disponível via tooling existente do projeto:

1. **Status da instância**: nova edge function `tv-cloud-status` que chama internamente o equivalente ao `cloud_status` (ou apenas faz um `SELECT 1` com timing — se falhar/lento, marca `warn`/`bad`).
2. **Edge function logs / latência / erros**: consulta `function_edge_logs` via RPC SQL existente (mesmo padrão usado por `useDispatcherHealth`). Vou criar um hook `useEdgeFunctionsHealth` que agrega por `function_id` nas últimas 24h.
3. **Banco**: `pg_stat_activity` (conexões), `pg_stat_statements` (slow queries) via RPC. Se `pg_stat_statements` não estiver habilitado, mostro só conexões + tamanho via `pg_database_size`.
4. **Storage/Mídia**: count e sum em `chat_messages` filtrando por `media_url IS NOT NULL` nas últimas 24h.

Tudo com `refetchInterval` de 30–60s, igual às outras cenas.

## Arquivos

**Criar**
- `src/pages/tv/hooks/useInfraStats.ts` — hooks: `useCloudInstanceStatus`, `useEdgeFunctionsHealth`, `useDatabaseStats`, `useStorageStats`
- `src/pages/tv/components/scenes/SceneInfraCloud.tsx` — nova cena seguindo padrão das existentes
- `supabase/functions/tv-infra-stats/index.ts` — edge function que executa as queries SQL administrativas (pg_stat_*, function_edge_logs) com service role e retorna JSON agregado

**Editar**
- `src/pages/tv/TvMasterPage.tsx` — adicionar a 4ª cena ao array `scenes`:
  ```ts
  { key: 'infra', title: 'Infraestrutura & Cloud', node: <SceneInfraCloud /> }
  ```

## Atualização e rotação

- A cena entra automaticamente no `TvSceneRotator` existente (ciclo 30s, fade entre cenas, dots clicáveis).
- Cada widget da cena tem seu próprio polling (React Query), independente do rodízio — quando a cena reaparece, mostra dados frescos.
- Sem mudança no `TvHeaderStrip` nem no `TvTicker` (eles continuam fixos no topo/rodapé).

## Tratamento de falhas

- Se `pg_stat_statements` não existir, oculto o widget de slow queries com fallback "Métrica não disponível".
- Se a edge function `tv-infra-stats` falhar, cada KPI mostra `—` em cinza (não quebra a cena).
- Status `INACTIVE` / `PAUSING` é destacado em vermelho com pulse, igual aos outros alertas críticos.
