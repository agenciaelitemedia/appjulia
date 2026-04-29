# Corrigir teto de 1000 nas métricas da TV (Canais & SLA)

## Causa raiz

O PostgREST do Supabase aplica `LIMIT 1000` por padrão em qualquer `select` sem `.limit()` explícito. As métricas afetadas baixam linhas brutas e contam no client, então quando há mais de 1000 registros no período elas estagnam em 1000.

Hooks com o problema:
- `src/pages/tv/hooks/useTvAggregates.ts` → `useChannelHealth()` (Volume por canal 24h e Saúde dos Canais 24h)
- `src/pages/tv/hooks/useGlobalSlaStats.ts` → SLA global (Header strip + ticker)
- `useTvAggregates.ts` também usa `.limit(1000)` explícito em `uazapi_history_runs` para calcular `error_pct`, o que enviesa o cálculo quando o volume é maior.

## Estratégia

Trocar "baixar linhas e contar no JS" por **contagem server-side** (`select('col', { count: 'exact', head: true })`) sempre que possível, e paginar quando precisarmos dos campos.

### 1. `useChannelHealth` (chat_messages 24h)

- Para cada canal conhecido (`whatsapp_uazapi`, `whatsapp_waba`, `webchat`, `instagram`), fazer 1 query com:
  ```ts
  supabase.from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('channel_type', ch)
    .gte('timestamp', since24h)
  ```
  → retorna apenas o `count`, sem trazer linhas (sem teto de 1000).
- Disparar as queries em paralelo com `Promise.all`.
- Para o bucket `unknown/Outros`: 1 query com `count exact` total + `is('channel_type', null)` (ou subtrair os conhecidos do total) — usar abordagem do total menos a soma dos conhecidos para também capturar valores inesperados.

### 2. `error_pct` por canal (uazapi_history_runs)

- Substituir o `.select('error').limit(1000)` por duas queries `count exact head:true`:
  - total runs últimas 24h
  - runs com `error not null` (ou `error = true`, conforme schema real — verificar antes de migrar)
- Calcular `Math.round(errs/total*100)` server-truthful.

### 3. `useGlobalSlaStats` (chat_conversations abertas/pending)

Como a função aplica `evaluateSla` por linha (precisa dos timestamps), não dá para resolver só com `count`. Solução: **paginação por range** até esgotar.

- Loop:
  ```ts
  let from = 0; const PAGE = 1000; const all = [];
  while (true) {
    const { data, error } = await supabase
      .from('chat_conversations')
      .select('id, client_id, status, priority, opened_at, first_response_at, resolved_at, closed_at')
      .in('status', ['pending','open'])
      .order('opened_at', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error || !data?.length) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  ```
- Salvaguarda: `MAX_PAGES = 20` (até 20k conversas) para evitar loop runaway; logar warn se atingir.
- Manter o restante da lógica `evaluateSla` intacta.

### 4. Verificação rápida pós-mudança

- Conferir que `chat_messages.channel_type` realmente existe e que `uazapi_history_runs.error` é o campo correto (boolean ou texto). Ajustar filtro `.not('error','is',null)` ou `.eq('error', true)` conforme schema.
- Validar visualmente no `/tv/master` que os números passam de 1000 quando o volume justifica.

## Notas técnicas

- `count: 'exact'` em tabelas grandes tem custo (sequential scan se sem índice). 24h + `channel_type` + `timestamp` deve ser barato; se for lento, considerar `planned` ou `estimated` em uma iteração futura.
- Não estamos mudando o `refetchInterval` (60s canais, 30s SLA).
- Nenhuma mudança de UI — só os hooks.

## Arquivos a alterar

- `src/pages/tv/hooks/useTvAggregates.ts` (useChannelHealth + bloco de error_pct)
- `src/pages/tv/hooks/useGlobalSlaStats.ts` (paginar conversas)
