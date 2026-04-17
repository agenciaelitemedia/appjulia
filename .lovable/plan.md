
User wants:
1. All header actions (AI, transfer, close, snooze, resolve, search, scheduled, help) are missing/hidden right now
2. Auto-assign on click should be REMOVED — conversation should only be assigned when user clicks "Assumir"

Looking at ChatHeader.tsx:
- Action buttons (snooze/transfer/resolve/close/help) are wrapped in `selectedConversation && ['pending', 'open'].includes(currentStatus)` — they show only for pending/open
- AI Assist, Search, Scheduled buttons render unconditionally
- "Assumir" button shows when `canTakeOver` (pending/open AND not assigned to me)

Possible reasons buttons are hidden:
- `selectedConversation` is null (header rendered from contact only, conversation not loaded)
- Status is closed/resolved
- Layout overflow hides them

Also from previous turn: `selectContact` auto-assigns to current user. Need to remove that.

## Plano

### 1. Remover auto-assign no `selectContact`
`src/contexts/WhatsAppDataContext.tsx`:
- Reverter `selectContact` para apenas `setSelectedContactId` + `markAsRead`
- NÃO atualizar `status` nem `assigned_to` automaticamente
- Conversa só vira "open" e ganha `assigned_to` quando usuário clica em "Assumir"

### 2. Garantir que ações apareçam sempre que houver conversa
`src/components/chat/ChatHeader.tsx`:
- Diagnosticar por que botões somem: provavelmente `selectedConversation` está null OU o overflow horizontal corta
- Reorganizar header: mover ações secundárias (search, scheduled, help) para dentro do menu `MoreVertical` para liberar espaço
- Manter visíveis na barra: **Assumir** (se aplicável), **IA**, **Transferir**, **Resolver**, **Encerrar**
- Remover condição `['pending', 'open'].includes(currentStatus)` do bloco principal — mostrar ações sempre que `selectedConversation` existir; desabilitar (não esconder) quando status for closed/resolved
- Adicionar `flex-wrap` ou `overflow-x-auto` no container de ações como fallback

### 3. Validação
- Abrir conversa pendente → vê: Assumir, IA, Transferir, Resolver, Encerrar, menu (...)
- Status continua `pending` e `assigned_to` continua vazio até clicar Assumir
- Ao clicar Assumir → vira open, assigned_to = você, botão Assumir some
- Conversa resolvida/encerrada → ações desabilitadas + botão Reabrir

### Arquivos a editar
- `src/contexts/WhatsAppDataContext.tsx` — remover auto-assign do `selectContact`
- `src/components/chat/ChatHeader.tsx` — reorganizar ações, sempre exibir, mover secundárias para o menu
