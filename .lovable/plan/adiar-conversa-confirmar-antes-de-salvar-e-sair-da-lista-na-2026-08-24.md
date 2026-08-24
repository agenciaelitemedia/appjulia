# Adiar conversa: confirmar antes de salvar e sair da lista na hora

Hoje, ao adiar uma conversa no JulIA Chat, o clique num preset (ou em "Adiar") grava direto no banco, sem confirmação, e a conversa continua visível na lista até um refetch — o realtime atualiza o campo `snoozed_until` na linha, mas não a remove.

## O que muda

1. **Confirmação do adiamento**
   - Ao escolher um preset ("1 hora", "Amanhã 9h"...) ou uma data personalizada, o diálogo passa a mostrar um passo de confirmação com o horário calculado em texto (ex.: "Adiar até 24/08/2026 09:00?") e os botões "Confirmar adiamento" / "Voltar".
   - Só ao confirmar é que o registro é salvo. O motivo (opcional) continua editável antes da confirmação.

2. **A conversa desaparece da lista ao salvar**
   - Depois de salvar, a linha é removida imediatamente da lista aberta (sem esperar refetch), a conversa selecionada é fechada (volta ao estado "Selecione uma conversa") e o contador de adiadas é atualizado.
   - Além do caminho otimista, o realtime também passa a remover qualquer linha cuja conversa receba `snoozed_until` no futuro enquanto o filtro "ocultar adiados" estiver ativo — garante que adiamentos feitos por outro atendente também saiam da lista sozinhos.

## Detalhes técnicos

- `src/modules/julia-chat/chat/components/SnoozeDialog.tsx`: novo estado `pending: Date | null`; presets e o botão de data personalizada passam a apenas setar `pending`; a gravação (`handleSnooze`) roda só no botão de confirmação. `onSnoozed` é chamado com o id da conversa.
- `src/modules/julia-chat/chat/components/ChatHeader.tsx`: nova prop opcional `onSnoozed?: (conversationId: string) => void`, repassada ao `SnoozeDialog`.
- `src/modules/julia-chat/components/JuliaChatConversation.tsx`: aceita e repassa `onSnoozed` ao `ChatHeader`.
- `src/modules/julia-chat/pages/JuliaChatPage.tsx`: passa um handler que chama `feeds.*.removeRow(conversationId)`, `setSelected(null)` e `refetchSnoozed()`.
- `src/modules/julia-chat/hooks/useJuliaChatFeed.ts`: expõe `removeRow(conversationId)` (remoção local + ajuste de contador) e, em `onConversation`, trata `snoozed_until` futuro como "não pertence a esta lista" quando `hide_snoozed` está ativo.
- `src/modules/julia-chat/hooks/useJuliaChatTabs.ts`: repassa `removeRow` para todas as abas, para remover a linha independentemente da aba ativa.

Sem mudanças de banco. O chat legado em `/chat-old` não é alterado.
