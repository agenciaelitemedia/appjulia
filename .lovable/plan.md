# Contador da aba mostra 1, lista vazia — causa e correção

## O que está acontecendo

A lista do JulIA Chat mostra **um card por contato**: entre várias conversas do mesmo contato, apenas a "líder" (a mais recente) aparece. Isso é feito na função do banco `chat_list_feed`.

O problema é que os **contadores das abas** (Aguardando / Atendimento) são calculados sobre **todas as conversas** que passam pelos filtros — inclusive conversas que não são a líder do contato — enquanto a **lista** só exibe as líderes.

Consequência prática do caso do "mário": existe um contato com mais de uma conversa; a conversa que casa com o filtro (ex.: status Aguardando) é uma conversa antiga do contato, e a conversa líder está em outro status (encerrada). Resultado: o contador soma 1, mas nenhuma linha é exibida — nada aparece na lista.

Confirmado na consulta ao banco: há contatos com nomes contendo "mario" que têm conversas duplicadas (rn = 1 e rn = 2) em status diferentes.

## Correção

Alinhar contadores e lista: contar apenas as conversas líderes (o mesmo conjunto que gera os cards).

1. Nova migração recriando `public.chat_list_feed` com o bloco `counted` calculado a partir de `leaders` (conversas líderes já filtradas), em vez de `filtered`.
2. Manter tudo o mais igual: `sibling_open_count` continua olhando todas as conversas irmãs (é justamente o badge de "outras conversas do contato"), ordenação, paginação, SLA, filtros e permissões sem alteração.
3. `total`, `pending`, `open`, `resolved`, `closed`, `sla_breached` e `sla_at_risk` passam a refletir exatamente o número de cards que a lista pode mostrar; `total_contacts` e `unread` já usavam `is_leader` e ficam idênticos.

Depois disso, o número na aba passa a ser sempre igual ao total de cards carregáveis, e o "Fim da lista, N carregados" fecha com o contador.

## Detalhes técnicos

- Arquivo: nova migração SQL em `supabase/migrations/` com `CREATE OR REPLACE FUNCTION public.chat_list_feed(...)` (mesma assinatura, `SECURITY DEFINER`, `search_path=public`, `statement_timeout=55s`).
- Única mudança no corpo: `counted AS (... FROM leaders)` em lugar de `FROM filtered`, com os `FILTER (WHERE is_leader)` restantes simplificados.
- Nenhuma mudança no frontend: `useJuliaChatFeed`, `useJuliaChatTabs` e `JuliaChatStatusTabs` continuam consumindo `counters` como hoje.

## Verificação

Rodar `chat_list_feed` com o mesmo filtro de busca usado ("mário") para os status Aguardando/Atendimento e conferir que `counters.pending`/`counters.open` batem com o número de linhas retornadas.
