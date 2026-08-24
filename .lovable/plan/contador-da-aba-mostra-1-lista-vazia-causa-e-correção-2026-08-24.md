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

## Busca: disparo por Enter e resultados em Encerrados

4. O campo de busca passa a ter estado local (rascunho). A busca só é aplicada ao pressionar **Enter** (ou ao clicar no ícone de busca); limpar o campo com o "x" limpa e reaplica na hora. Assim não há mais uma consulta por tecla digitada.
5. Enquanto houver termo de busca ativo, a aba **Encerrados** é carregada automaticamente (mesmo sem o usuário abri-la), para que o resultado apareça também lá.
6. Com busca ativa, cada aba (Aguardando / Atendimento / Encerrados) mostra o contador do **seu próprio resultado filtrado**, deixando visível em qual aba a conversa encontrada está.

## Detalhes técnicos

- Arquivo: nova migração SQL em `supabase/migrations/` com `CREATE OR REPLACE FUNCTION public.chat_list_feed(...)` (mesma assinatura, `SECURITY DEFINER`, `search_path=public`, `statement_timeout=55s`).
- Única mudança no corpo: `counted AS (... FROM leaders)` em lugar de `FROM filtered`, com os `FILTER (WHERE is_leader)` restantes simplificados.
- `JuliaChatFilters.tsx`: input passa a usar valor local + `onKeyDown` (Enter) em vez de `onChange` propagando direto; o valor local sincroniza quando `filters.search` muda por fora.
- `useJuliaChatTabs.ts`: `closedTouched` também fica ativo quando `filters.search` não está vazio (aba Encerrados carrega junto).
- `JuliaChatStatusTabs.tsx` / `JuliaChatPage.tsx`: com busca ativa, o badge de cada aba usa o contador daquele feed (`feeds[tab].counters`) em vez do contador global.

## Verificação

Rodar `chat_list_feed` com o mesmo filtro de busca usado ("mário") para os status Aguardando/Atendimento/Encerrados e conferir que os contadores batem com o número de linhas retornadas em cada aba.

