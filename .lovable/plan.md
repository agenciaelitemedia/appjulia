# Capacidade: liberar vagas presas em conversas abertas e paradas

## O que foi confirmado no banco

Escritório 300, conversas `open` com responsável definido (as que consomem vaga hoje):

| Situação | Conversas |
|---|---|
| Sem mensagem do cliente há mais de 7 dias | 326 |
| Sem mensagem do cliente entre 3 e 7 dias | 63 |
| Com movimentação recente (menos de 3 dias) | 42 |
| Em snooze ativo | 1 |

Atendentes acima do teto configurado:

- Charles Vianna — 121/20
- Stherffany - Atendimento — 113/20
- Tell Moitas — 34/10

O caso do Tell Moitas: as 34 conversas existem de verdade com `status = 'open'`, várias abertas em junho/julho e sem resposta do cliente há dias. Ou seja, a contagem está certa pela regra atual (`chat_agent_live_load` conta todo `open` com responsável); o problema é que conversas paradas nunca são encerradas e ficam ocupando vaga para sempre. Isso é sistêmico, não específico de um usuário: apenas 42 das 432 conversas que consomem vaga têm movimentação nos últimos 3 dias.

## Correção proposta

Duas frentes complementares.

### 1. Carga passa a considerar só atendimento vivo

`chat_agent_live_load` continua contando `status = 'open'` com responsável, mas deixa de contar:

- conversas em snooze ativo (`snoozed_until > now()`) — estão adiadas de propósito;
- conversas paradas: sem mensagem do cliente (`last_customer_message_at`, com fallback em `opened_at`) há mais de N dias.

N fica configurável por escritório em `chat_client_settings.settings.capacity_idle_days`, com padrão 7 dias. Assim cada escritório ajusta o rigor sem migração nova.

Como todos os consumidores derivam dessa função, o ajuste propaga automaticamente para bloqueio de atribuição manual, distribuição automática, automações, API pública, transferência em massa, espelho `chat_agent_capacity.current_load` e os badges de carga na UI.

### 2. Encerramento automático de conversas paradas

Rotina diária (pg_cron) que resolve conversas `open` sem interação do cliente há mais de N dias (mesmo parâmetro), gravando `close_reason = 'auto_idle'` e registro em `chat_conversation_history`. Isso limpa o acervo de verdade, em vez de só escondê-lo da contagem. Conversas em snooze ativo e com movimentação recente nunca são tocadas.

Efeito imediato esperado após a primeira execução: Charles, Stherffany e Tell Moitas voltam para dentro do teto e param de receber o bloqueio.

## Transparência na UI

No badge/tooltip de capacidade, mostrar a composição: "9 em atendimento · 25 paradas (não contam)". Sem isso, o número muda e ninguém entende por quê.

## Detalhes técnicos

- Migração com `CREATE OR REPLACE FUNCTION public.chat_agent_live_load(text)`: adiciona os filtros de snooze e inatividade, lendo `capacity_idle_days` de `chat_client_settings` (`coalesce(..., 7)`). Assinatura e retorno inalterados.
- Nova função `public.chat_resolve_idle_conversations(p_client_id text default null)` marcando `status='resolved'`, `resolved_at=now()`, `close_reason='auto_idle'`; agendada por `cron.schedule` uma vez ao dia.
- Ressincronizar o espelho `chat_agent_capacity.current_load` a partir de `chat_agent_live_load` logo após a migração.
- Índice de apoio em `chat_conversations (client_id, status, last_customer_message_at)` para os filtros novos.
- Atualizar comentários de regra em `supabase/functions/_shared/chat/capacity.ts` e `src/lib/chat/capacity.ts`.
- Frontend: `useChatAgentCapacity.ts` passa a expor também a contagem de paradas para o tooltip (nova RPC leve ou coluna extra na função de carga).
