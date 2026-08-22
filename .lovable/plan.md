# Por que /mvp-chat e /chat mostram dados diferentes

As duas telas leem as mesmas tabelas, mas montam o "universo" da lista de formas diferentes. Verifiquei no banco e as divergências abaixo são reais (números atuais).

## Causas confirmadas

1. **Base da lista é diferente**
   - `/chat`: parte de `chat_contacts` (paginado), filtrando por `channel_source` dentro das filas acessíveis, e ordena/filtra período por `chat_contacts.last_message_at`.
   - `/mvp-chat`: parte da *conversa líder* por contato (`DISTINCT ON (contact_id)` em `chat_conversations`), filtrando por `chat_conversations.queue_id` e período por `COALESCE(last_message_at, conversation_updated_at)`.
   - Impacto medido: 608 contatos em que `channel_source` ≠ fila da conversa líder (entram/saem do filtro de fila em telas diferentes); 4.172 contatos com `last_message_at` nulo (136 deles com conversa movimentada nos últimos 7 dias — aparecem só no MVP, pelo fallback para `updated_at`); 33.885 casos em que `contact.last_message_at` e `conversa.updated_at` divergem, o que muda ordenação e o bucket de período.

2. **Totalizadores contam coisas diferentes**
   - `/chat` conta **todas** as conversas carregadas: 37.955 em `pending/open`.
   - `/mvp-chat` conta **uma conversa por contato**: 37.810. Diferença de 145 (contatos com mais de uma conversa aberta).

3. **Filtro de acesso a filas**
   - `/chat` usa filas acessíveis ao usuário (ativas + vínculo do usuário).
   - `/mvp-chat` só descarta `queues.is_deleted` e ainda aceita conversas sem fila. Hoje deleted = inativa (674 líderes), então o efeito visível é a ausência da restrição por usuário: um atendente vê no MVP conversas de filas às quais não tem acesso.

4. **Regra de visibilidade por papel**
   - `/chat` esconde conversas `open` que não são do próprio usuário quando ele não é admin/owner.
   - `/mvp-chat` não aplica isso — mais itens na aba Atendimento para atendentes comuns.

5. **Adiadas (snooze) e "modo Julia/humano"**
   - `/chat` esconde por padrão conversas com `snoozed_until` futuro e tem filtro de modo (Julia vs humano) baseado em sessão do agente.
   - `/mvp-chat` não filtra snooze nem modo.

6. **Normalização de status**
   - O MVP reclassifica `pending` com responsável como `open`. Hoje há 0 registros nesse caso, então não explica diferença atual, mas explicaria no futuro.

## Correções propostas (no MVP, sem tocar em /chat)

Objetivo: o MVP deve reproduzir o `/chat` como fonte de verdade.

1. Trocar a âncora de tempo/ordenação da função `mvp_chat_list_feed` para `COALESCE(ct.last_message_at, l.updated_at)` no filtro de período (já usa esse coalesce, mas com a coluna da conversa em precedência inconsistente) e explicitar `contact.last_message_at` como preferência primária, igual ao `/chat`.
2. Filtro de fila: aceitar match por `l.queue_id` **ou** `ct.channel_source`, para não perder/ganhar os 608 contatos divergentes.
3. Passar a lista de filas acessíveis do usuário (as mesmas de `useAccessibleQueues`) como `p_queue_ids` padrão e excluir filas inativas (`q.is_active = false`) além de deletadas.
4. Adicionar parâmetros de escopo: `p_hide_snoozed` (default true) e `p_restrict_open_to` (id/nome do usuário) para replicar a regra de papel; o front envia conforme `isAdmin`/`isOwner`.
5. Totalizadores: manter contagem por conversa líder na lista, mas calcular os badges sobre **todas** as conversas do escopo filtrado (como o `/chat`), para os números baterem.
6. Documentar no módulo MVP que a conversa exibida por contato é a líder (mais recente), e mostrar contador de conversas extras do contato quando houver mais de uma aberta.

## Detalhes técnicos

- Alterar `public.mvp_chat_list_feed` (nova migration com `CREATE OR REPLACE`): CTE `base` passa a incluir `ct.channel_source` no predicado de fila, `q.is_active`, e `counted` passa a agregar de uma CTE separada sobre `chat_conversations` (não só líderes).
- `supabase/functions/mvp-chat-list-feed/index.ts`: repassar os novos parâmetros e manter cache key incluindo eles.
- `src/modules/mvp-chat/hooks/useMvpChatFeed.ts` / `useMvpChatTabs.ts`: enviar filas acessíveis, `hideSnoozed`, e escopo por papel; nenhum arquivo de `/chat` é modificado.
