# Limite de atendimentos: só quando configurado

## O que está implementado hoje (verificado)

- O teto padrão é aplicado a **todos**: `DEFAULT_MAX_CONCURRENT = 20` em `src/lib/chat/capacity.ts` e `supabase/functions/_shared/chat/capacity.ts`; a função de banco `chat_capacity_check` também devolve `coalesce(..., 20)` quando o atendente não tem registro em `chat_agent_capacity`. Ou seja, quem nunca foi configurado é bloqueado ao chegar em 20.
- O bloqueio ocorre em **todos os caminhos de atribuição**, independentemente da distribuição automática: atribuição manual (`juliaChatActions.assignConversation`, `WhatsAppDataContext`), `chat-route-conversation`, `chat-bulk-transfer`, `chat-automation-engine`, `chat-public-api`, `chat-rebalance-overflow`.
- O switch master `chat_client_settings.settings.auto_distribution_enabled` existe (aba Distribuição Automática) e hoje só é consultado pela distribuição automática — a capacidade o ignora.
- `is_active = false` no registro de capacidade hoje não desliga o limite (o teto ainda é lido).

## Correção proposta

Regra única: **um atendente só tem limite se (1) a distribuição automática do escritório estiver habilitada E (2) existir registro ativo em `chat_agent_capacity` para ele com `max_concurrent` definido.** Em qualquer outro caso: sem limite, nenhum bloqueio.

1. **Banco** — nova migração:
   - `chat_capacity_check` passa a devolver `max_concurrent = NULL` e `blocked = false` quando não há registro para o atendente, quando `is_active = false`, quando `max_concurrent` é nulo/<= 0, ou quando `auto_distribution_enabled` do escritório não está ativo (lido de `chat_client_settings.settings`). Sem fallback 20.
   - Nova coluna de retorno `enforced boolean` para a UI e o servidor saberem se há limite.

2. **Servidor** (`supabase/functions/_shared/chat/capacity.ts`):
   - remover `DEFAULT_MAX_CONCURRENT` como fallback; `checkCapacity` retorna `enforced: false` → nunca bloqueia;
   - `loadAllCapacity` só marca `blocked` para atendentes com limite ativo;
   - consumidores (`chat-route-conversation`, `chat-bulk-transfer`, `chat-automation-engine`, `chat-public-api`, `chat-rebalance-overflow`) passam a tratar `enforced = false` como capacidade livre — atendentes sem limite voltam a ser elegíveis na distribuição e no rebalanceamento (o rebalanceamento só devolve à fila excedente de quem tem teto configurado).

3. **Front** (`src/lib/chat/capacity.ts`, `useChatAgentCapacity.ts`):
   - `assertCapacity` não bloqueia quando `enforced = false`;
   - o hook deixa de criar linha "padrão 20" para quem não tem registro; expõe `enforced`.

4. **UI**:
   - `TeamMemberSelect` (chat, `JuliaAssignDialog`, transferências): badge `carga/teto` e item desabilitado **apenas** para atendentes com limite configurado e ativo; os demais mostram apenas a carga, sem teto e sem bloqueio.
   - Aba "Distribuição Automática": aviso no card de capacidade de que os limites só valem com a distribuição automática ativada, e indicação clara de "sem limite" para atendentes sem registro.

## Detalhes técnicos

- Migração altera apenas as funções `chat_capacity_check` (assinatura de retorno com `enforced`); `chat_agent_live_load` e o trigger de espelho de `current_load` ficam como estão.
- Leitura do switch dentro da função SQL: `chat_client_settings.settings->>'auto_distribution_enabled'` do `client_id`, tratando ausência como desabilitado.
- Mensagem de bloqueio permanece a mesma, mas só aparece nos casos realmente configurados.
