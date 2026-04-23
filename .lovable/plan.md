

## Ao assumir atendimento, mudar automaticamente para aba "Em atendimento"

### Diagnóstico

Hoje em `/chat`, quando o usuário clica em "Assumir atendimento" numa conversa pendente:

1. A conversa muda de `status='pending'` para `status='open'` no banco
2. A aba ativa continua em "Pendentes" (`conversationStatusFilter='pending'`)
3. O usuário fica olhando a lista de pendentes e perde a referência da conversa que acabou de assumir — ela some da lista atual

### Correção

No handler que assume o atendimento, após o sucesso da operação chamar `setConversationStatusFilter('open')` para alternar a aba ativa para "Em atendimento", onde a conversa recém-assumida agora aparece.

### Arquivo afetado

- `src/contexts/WhatsAppDataContext.tsx` (ou o componente/handler que executa a ação "assumir atendimento") — após o update de status para `open`, disparar a troca de aba para `'open'`.

### Detalhes técnicos

1. Localizar a função `assumeConversation` / `takeConversation` (ou equivalente) que faz o `update` em `chat_conversations` setando `status='open'` + `assigned_to`
2. Imediatamente após o sucesso (antes do `loadConversations`), chamar `setConversationStatusFilter('open')`
3. Manter a seleção da conversa (`selectContact` permanece igual) — a sidebar troca de aba e a conversa selecionada continua aberta no painel central

### Validação

1. Em `/chat`, aba "Pendentes" selecionada, abrir uma conversa pending
2. Clicar em "Assumir atendimento"
3. A aba ativa deve mudar automaticamente para "Em atendimento"
4. A conversa assumida aparece na lista da nova aba e continua aberta no painel central
5. Badge "Pendentes" decrementa, badge "Em atendimento" incrementa

