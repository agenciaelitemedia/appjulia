# Espelho do banco legado: isolamento por escritório + redução de escrita

Duas correções na forma como o painel espelha os dados do banco antigo (etapa da Júlia, Júlia ligada/desligada, campanha) dentro do banco do painel. Sem mudar o comportamento visível da lista de conversas.

## 1. Isolar os dados por escritório

Hoje a consulta ao banco antigo procura **só pelo telefone**. Se o mesmo número existir em dois escritórios, o dado de um pode acabar gravado no espelho do outro.

Correções em `supabase/functions/julia-chat-list-feed/index.ts`:

- A busca de etapas do CRM da Júlia passa a exigir também o código do agente da fila (`cod_agent`), do mesmo jeito que a busca de sessões já faz.
- A busca de campanhas passa a resolver o agente pela sessão vinculada e a respeitar o mesmo filtro.
- Remoção do "encaixe por telefone solto" (o fallback que casa qualquer registro do número quando o código do agente não bate). Quando não houver código de agente na fila, a conversa fica sem badge do legado em vez de receber um badge possivelmente de outro escritório.
- Limpeza pontual do espelho: apagar as linhas gravadas sem código de agente, para que sejam recarregadas já isoladas.

Efeito colateral aceito: filas ainda não vinculadas a um agente da Júlia deixam de exibir badge de etapa/campanha — que é o comportamento correto, já que não há como saber a qual escritório o dado pertence.

## 2. Reduzir escrita e inchaço da tabela

Medição atual: 3.176 linhas no espelho receberam **96.047 regravações em ~3 dias** (≈30 por linha) e a tabela ocupa 53 MB. Cada regravação custa linha nova, três índices e log de transação no banco que já está sob pressão de disco.

- Gravar **apenas quando o valor mudou** (comparação com o que já está no espelho). Quando nada mudou, só a marca de "última verificação" é atualizada, em uma única operação em lote.
- Aumentar a janela de revalidação de conversas ativas de 60s para 180s (o botão Recarregar continua forçando atualização imediata).
- Remover o índice de `fetched_at`, que hoje encarece toda atualização e não é usado em consulta do painel — a limpeza periódica não precisa dele.
- Criar rotina diária de limpeza: descartar linhas do espelho sem verificação há mais de 30 dias.
- `VACUUM` na tabela após as mudanças para devolver o espaço já inchado.

Resultado esperado: queda de mais de 90% nas gravações do espelho e estabilização do tamanho da tabela, sem alterar o que o atendente vê.

## Fora deste escopo

- Sincronismo por evento (invalidar o espelho no momento em que a Júlia liga/desliga ou o card muda de etapa) — fica como diagnóstico registrado; os badges continuam com atraso de até 3 minutos em conversas ativas e 10 minutos em antigas.
- Correção dos contadores no modo de filtro por etapa/Júlia/campanha (hoje calculados sobre um teto de 1500 linhas).

## Detalhes técnicos

- Arquivo: `supabase/functions/julia-chat-list-feed/index.ts` — CTEs `stages` e `camps` ganham filtro `cod_agent::text = ANY($2)`; remoção dos `stageByKey.set(key, ...)` / `sessionByKey.get(m.phone_key)` de fallback; diff antes do `upsert` em `chat_legacy_cache`; `TTL_HOT` 60 → 180.
- Migração: `DROP INDEX mvp_chat_legacy_cache_fetched_idx`; função `chat_legacy_cache_cleanup()` + agendamento `pg_cron` diário; sem mudança de colunas, RLS ou grants (a tabela segue acessível só pelo servidor).
- Manutenção pontual via `run_sql`: `DELETE` das linhas com `cod_agent = ''` e `VACUUM (ANALYZE) public.chat_legacy_cache`.
- Redeploy da função `julia-chat-list-feed`; validação pelo painel de métricas do chat (`external_ms`, `cache_hits`, `cache_refreshed`) e por `pg_stat_user_tables.n_tup_upd`.
