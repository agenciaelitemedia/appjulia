# Por que o lead 5581993162997 não aparece na lista

## Causa confirmada

O contato existe no seu escritório (client_id 294, fila **Comercial**, conversa aberta, protocolo #2026-067002, responsável **Dra. Joyce**, usuário 384).

A conversa está **adiada (snooze)** até **27/08/2026 17:09**, adiada pela própria Dra. Joyce. A lista do chat esconde conversas adiadas por padrão (`hide_snoozed = true`), então ela não aparece nem na busca por telefone — mesmo para o owner, que já enxerga conversas de outros atendentes.

Ou seja: não é permissão, nem fila, nem busca. É o filtro de retorno agendado.

## Onde ela está visível hoje

- Painel "Retornos agendados" (ícone de relógio na barra de filtros do chat).
- Desativando "Ocultar adiadas" nos filtros.

## Proposta de ajuste (opcional, escolha uma)

1. **Busca ignora snooze**: quando há texto na busca (nome/telefone/protocolo), a lista passa a mostrar também as conversas adiadas, com um selo "Adiada até dd/mm hh:mm". Resolve exatamente o caso "procurei o número e não achei".
2. **Contador visível**: manter o comportamento atual e exibir no painel de retornos um badge com a quantidade de conversas adiadas, para ficar evidente que existem conversas ocultas.

Recomendo a opção 1 (com o selo), somando o badge da opção 2.

## Detalhes técnicos

- `chat_conversations.snoozed_until` = 2026-08-27 17:09, `snoozed_by` = 384.
- `chat_list_feed` aplica `p_hide_snoozed` (default true) antes de qualquer filtro de busca; `JuliaChatPage.tsx` envia `hide_snoozed: debounced.hide_snoozed ?? true`.
- Opção 1: em `JuliaChatPage.tsx`, forçar `hide_snoozed: false` quando `debounced.search` estiver preenchido; em `JuliaChatRow.tsx`, exibir selo quando `snoozed_until > now` (o campo já vem no feed).
- Opção 2: badge de contagem no botão do painel de retornos, reutilizando a query já existente do painel.
- Nenhuma mudança de RLS, permissões ou banco é necessária.
