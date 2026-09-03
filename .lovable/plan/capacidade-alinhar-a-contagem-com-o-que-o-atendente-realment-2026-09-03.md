# Capacidade: alinhar a contagem com o que o atendente realmente atende

## Duas causas confirmadas no banco

### 1. Conversas fora das filas que o atendente enxerga (caso da Letícia, id 415)

As 20 conversas `open` atribuídas a ela estão distribuídas assim:

| Fila | Conversas |
|---|---|
| A3 PREV | 14 |
| Tell Pessoal | 2 |
| 84 998185064 - Escritório Flávia | 2 |
| FIXO NATAL | 1 |
| Charles DDD 11 | 1 |

Ela só tem vínculo com A3 PREV, e a lista de conversas do chat filtra pelo allowlist de filas do usuário (`useUserQueueAccess`). Por isso o chat mostra 14 e a capacidade mostra 20/20: as 6 restantes estão atribuídas a ela em filas que ela nem vê — não são contatos duplicados (20 conversas, 20 contatos distintos).

### 2. Conversas abertas e paradas há dias (caso Tell Moitas, Charles, Stherffany)

No escritório 300, das 432 conversas `open` com responsável que consomem vaga hoje:

| Situação | Conversas |
|---|---|
| Sem mensagem do cliente há mais de 7 dias | 326 |
| Sem mensagem do cliente entre 3 e 7 dias | 63 |
| Movimentação nos últimos 3 dias | 42 |
| Em snooze ativo | 1 |

Acima do teto: Charles Vianna 121/20, Stherffany 113/20, Tell Moitas 34/10. As conversas existem de verdade; o problema é que atendimento parado nunca é encerrado e ocupa vaga para sempre.

## Correção proposta

### A. Carga passa a usar a MESMA regra da lista de conversas

Em vez de manter uma segunda regra de contagem, a capacidade passa a derivar da consulta unificada que já alimenta a lista do chat (`chat_list_feed`), que hoje já recebe filas permitidas (`p_queue_ids`), status (`p_status`), responsável (`p_owner`) e ocultar adiadas (`p_hide_snoozed`). Isso garante, por definição, que "o número da capacidade" e "o que o atendente vê no chat" nunca mais divirjam.

Implementação: extrair o predicado do `chat_list_feed` para uma função de contagem `chat_agent_live_load` reescrita sobre o mesmo filtro, contando por atendente com:

- filas permitidas do atendente (quem não tem vínculo continua contando tudo);
- `status = 'open'` (em atendimento);
- snooze ativo não conta (a conversa está adiada e sai da lista).

Conversas antigas sem resposta continuam contando normalmente: são atendimento pendurado na lista do atendente e ocupam vaga de verdade.

Como todos os consumidores derivam dessa função, o ajuste propaga para bloqueio de atribuição manual, distribuição automática, automações, API pública, transferência em massa, espelho `chat_agent_capacity.current_load` e badges na UI.

### B. Limpeza do acervo parado (manual, sob comando)

Nada é encerrado automaticamente. O que já existe de encerramento/transferência em lote ganha um filtro de "sem resposta do cliente há X dias", para o gestor limpar o acervo quando quiser e liberar vagas de forma consciente.

### C. Higienizar as atribuições órfãs

Relatório (e ação de correção em lote, com confirmação) das conversas atribuídas a atendentes que não têm acesso à fila: devolver para a fila como `pending` sem responsável, para que quem tem acesso assuma. Isso resolve as 6 conversas invisíveis da Letícia e casos iguais nos outros usuários.

### D. Transparência na UI

No badge/tooltip de capacidade, mostrar a composição: "14 em atendimento · 6 fora das suas filas · 1 adiada (não contam)". Sem isso o número muda e ninguém entende por quê.


## Detalhes técnicos

- Migração com `CREATE OR REPLACE FUNCTION public.chat_agent_live_load(text)` reescrita sobre o predicado compartilhado com `chat_list_feed` (mesmos filtros de fila, status e snooze), extraído para uma CTE/função auxiliar reutilizada pelos dois — uma fonte só de verdade. Assinatura e retorno inalterados; colunas de composição vão em função nova para não quebrar chamadores.
- O allowlist de filas hoje vive no Postgres legado (`externalDb.getUserQueueAccess`). Como a função de carga roda no Supabase, o filtro usará `queue_agent_links` + `queues` do Supabase; se o atendente não tiver nenhum vínculo, o comportamento é "vê todas" (igual ao default atual do hook), para não zerar carga de quem nunca foi vinculado.
- Ressincronizar `chat_agent_capacity.current_load` a partir de `chat_agent_live_load` após a migração.
- Índice de apoio em `chat_conversations (client_id, status, queue_id, assigned_user_id)`.
- Atualizar comentários de regra em `supabase/functions/_shared/chat/capacity.ts` e `src/lib/chat/capacity.ts`; `useChatAgentCapacity.ts` passa a expor a composição para o tooltip.
