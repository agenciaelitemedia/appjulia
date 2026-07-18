## Diagnóstico (lead 5585996578548)

Conversa `5bfba29f…` está com `snoozed_until = 2026-07-20 12:00 UTC` (adiada pela Dra. Flávia Freitas em 18/07 10:27 UTC). Hoje isso a esconde de todas as abas do chat até o horário vencer — sem sinal visual e sem forma de listar os adiados.

## Objetivo

Dar visibilidade aos adiados sem criar nova aba. Um ícone de agenda na barra da lista de conversas (à direita do ícone de ordenar) abre um sidebar à direita listando as conversas adiadas com a data/hora de retorno.

## Mudanças

1. **Ícone "Agenda de retornos" na barra da lista** (`ChatList.tsx`)
   - Adicionar botão com ícone `CalendarClock` (lucide) imediatamente à direita do botão de ordenar.
   - Badge numérico discreto com a contagem de conversas adiadas ativas (`snoozed_until > now`) do escopo atual (mesma fila / permissões que a lista já respeita).
   - Sem alteração nas abas, filtros ou contadores atuais. Snoozed continuam ocultos das abas normais (comportamento preservado).

2. **Novo componente `SnoozedConversationsPanel.tsx`** (sidebar à direita)
   - Usa `Sheet` (side="right"), largura ~`w-[420px]`, seguindo o padrão dos outros painéis do chat (`ContactDetailPanel`, `ScheduledMessagesList`).
   - Header: título "Conversas adiadas" + contagem + botão fechar.
   - Lista ordenada por `snoozed_until` ASC (o próximo a retornar primeiro).
   - Cada item mostra:
     - Avatar + nome do contato (fallback = telefone).
     - Último preview curto da conversa.
     - Chip com data/hora de retorno: relativa ("em 2d 4h") + absoluta em BRT no tooltip.
     - Nome de quem adiou (derivado da última entrada `action = 'snoozed'` em `chat_conversation_history`).
     - Fila da conversa (badge pequeno).
   - Ações por item:
     - Clique no item: fecha o sidebar, seleciona o contato via `selectContact(contact_id)` e (se necessário) troca `selectedQueue` para a fila da conversa — mesmo padrão usado por `readPendingSelection`.
     - Botão "Retomar agora": `UPDATE chat_conversations SET snoozed_until = NULL` + registro em `chat_conversation_history` (`action: 'snooze_cancelled'`, `actor_name = user.name`). Otimista, com toast e rollback em caso de erro.
   - Estado vazio: "Nenhuma conversa adiada".
   - Realtime: reaproveita `useContactLatestConversation` (já carrega `snoozed_until`) para atualizar a lista quando alguém adia/retoma em outra sessão.

3. **Dados**
   - Fonte primária: `leaderByContact` já disponível em `WhatsAppDataContext` — filtra por `snoozed_until > now`. Sem query nova para a lista.
   - `snoozed_by`: `select action, actor_name, to_value, created_at from chat_conversation_history where conversation_id in (...) and action='snoozed' order by created_at desc` limitado aos IDs visíveis no painel (uma query só, sob demanda ao abrir o sidebar).
   - Contatos: já em memória (`contacts`) ou hidratados por `useChatContactsByIds` se algum estiver fora da lista atual.

## Não muda

- Nada nas abas, contadores, filtros, ordenação, atribuição, auto-return NRT, resolve automático.
- Schema do banco (só usa `snoozed_until` + `chat_conversation_history`, já existentes).
- Comportamento do `SnoozeDialog` atual.

## Arquivos afetados

- `src/components/chat/ChatList.tsx` — adiciona botão + badge + estado `snoozedPanelOpen`.
- `src/components/chat/SnoozedConversationsPanel.tsx` — novo componente.
- (Nenhuma alteração em contexto, hooks de dados ou schema.)