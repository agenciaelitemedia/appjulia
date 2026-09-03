# Capacidade do atendente: contar apenas conversas em atendimento

## Como está hoje (verificado no banco)

- A carga é calculada pela função `chat_agent_live_load(client_id)`, que conta conversas de `chat_conversations` com `status IN ('open','pending')` e que tenham responsável (`assigned_user_id` ou `assigned_to`).
- `chat_capacity_check` usa essa mesma função para obter `load` e comparar com `max_concurrent` (limite só existe com distribuição automática ativa + registro ativo com `max_concurrent > 0`).
- O trigger `chat_conversations_sync_agent_load` → `chat_sync_agent_load` apenas espelha esse mesmo valor em `chat_agent_capacity.current_load`.
- Portanto, hoje conversas na aba "Aguardando" (`pending`) que já tenham responsável entram na conta e consomem vaga (hoje há 123 conversas `pending` com responsável no banco).

## Correção proposta

Uma única mudança na origem do cálculo: `chat_agent_live_load` passa a contar somente `status = 'open'` (em atendimento com o lead), ignorando `pending`, `resolved` e `closed`.

Como todos os consumidores derivam dessa função, o ajuste propaga automaticamente para:

- `chat_capacity_check` (bloqueio de atribuição manual, distribuição automática, automações, API pública, transferência em massa);
- espelho `chat_agent_capacity.current_load` (via `chat_sync_agent_load`);
- badges de carga/teto na UI (`useChatAgentCapacity`, `TeamMemberSelect`) e rebalanceamento de excedentes.

Nenhuma alteração de UI ou de regra de limite: quem não tem limite configurado continua ilimitado.

## Detalhes técnicos

- Nova migração com `CREATE OR REPLACE FUNCTION public.chat_agent_live_load(text)` alterando apenas o filtro de status para `conv.status = 'open'` (assinatura e retorno inalterados).
- Ressincronizar o espelho após a migração: `UPDATE chat_agent_capacity` a partir de `chat_agent_live_load` para cada `client_id`/`agent_identifier`, de modo que `current_load` fique coerente imediatamente.
- Atualizar os comentários em `supabase/functions/_shared/chat/capacity.ts` e `src/lib/chat/capacity.ts` que dizem "open/pending" para refletir a nova regra (sem mudança de lógica).
