# Snooze deve ser cancelado quando o lead responde

## O caso investigado (5581993162997)

O contato existe no seu escritório (client_id 294, fila **Comercial**, conversa aberta, protocolo #2026-067002, responsável **Dra. Joyce**).

A conversa foi **adiada (snooze) até 27/08/2026 17:09** e o lead **voltou a mandar mensagem em 26/08 às 12:11** — ou seja, a conversa continuou escondida da lista mesmo com mensagem nova do cliente. É exatamente o comportamento errado que você descreveu: o lead fica sem resposta até o fim do snooze.

Hoje nada no sistema cancela o snooze: o gatilho de banco que registra a mensagem do cliente só atualiza `last_customer_message_at` / `last_message_from_me`, e nenhum webhook limpa `snoozed_until`.

## O que será implementado

1. **Cancelamento automático do snooze na mensagem do cliente**
   Quando entra qualquer mensagem recebida (não enviada pelo atendente) numa conversa adiada, o snooze é cancelado imediatamente e a conversa volta a aparecer na lista, no topo (mensagem nova).
   - Vale para todos os canais (WhatsApp não oficial, API Oficial, Instagram, WebChat), porque a regra fica no banco, não em cada webhook.
   - O responsável e a etapa/status não mudam: só o adiamento é removido.

2. **Registro no histórico da conversa**
   Uma linha no histórico: "Retorno agendado cancelado automaticamente — o cliente respondeu", para o atendente entender por que a conversa reapareceu.

3. **Limpeza dos casos já presos**
   Cancelar o snooze das conversas que já estão adiadas mas cujo cliente respondeu depois do adiamento (inclui a conversa do 5581993162997).

4. **Busca não esconde adiadas**
   Ao pesquisar por nome, telefone ou protocolo, conversas adiadas passam a aparecer com um selo "Adiada até dd/mm hh:mm" — assim uma busca por número nunca mais "não encontra" um lead que existe.

## Detalhes técnicos

- Ajustar `public.update_conversation_message_tracking()` (trigger em `chat_messages`): quando `NEW.from_me = false`, também setar `snoozed_until = NULL, snoozed_by = NULL, snooze_reason = NULL` e `updated_at = now()` — só quando `snoozed_until IS NOT NULL`.
- Inserir evento em `chat_conversation_history` no mesmo trigger (tipo/ação de sistema, sem responsável), respeitando o formato já usado pelos demais eventos.
- Backfill: `UPDATE chat_conversations SET snoozed_until = NULL ... WHERE snoozed_until > now() AND last_customer_message_at > <momento do snooze>` (usando `updated_at`/histórico como referência conservadora).
- Frontend (`src/modules/julia-chat`): em `JuliaChatPage.tsx`, enviar `hide_snoozed: false` quando `filters.search` estiver preenchido; em `JuliaChatRow.tsx`, selo quando `snoozed_until` futuro (campo já retornado por `chat_list_feed`).
- `useSnoozeExpiryWatcher` / `JuliaSnoozedPanel` continuam funcionando: passam a refletir a lista já sem os itens cancelados via invalidação de cache existente (realtime em `chat_conversations`).
- Sem mudanças de RLS ou permissões.
