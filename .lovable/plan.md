## Objetivo

Tornar o deep-link via `sessionStorage` (`chat_pending_contact_id`, `chat_pending_queue_id`, `chat_pending_conversation_id`) resiliente a:
- Cliques repetidos em "Abrir no Chat" em cards diferentes antes do `/chat` consumir os valores.
- Voltar para o CRM e reabrir o painel — restos antigos não podem reaparecer.
- Valores corrompidos / não-UUID / fila inexistente / sem permissão.
- Race entre o `useEffect` de fila e o de contato (hoje o contato pode ser aplicado antes da fila estar pronta).

## Mudanças

### 1. Helper centralizado `src/lib/chat/pendingSelection.ts` (novo)

Encapsula leitura/escrita/limpeza com validação:

- `PENDING_KEYS = ['chat_pending_contact_id', 'chat_pending_queue_id', 'chat_pending_conversation_id', 'chat_pending_ts'] as const`
- `setPendingSelection({ contactId, queueId?, conversationId? })`:
  - Valida UUID (`/^[0-9a-f-]{36}$/i`); descarta campos inválidos.
  - Sempre **limpa todas as chaves antes** de escrever (evita mistura entre cards).
  - Grava `chat_pending_ts = Date.now()`.
- `readPendingSelection()`:
  - Retorna `null` se não houver `contact_id` válido.
  - Retorna `null` e limpa tudo se `ts` for ausente ou mais antigo que **60s** (TTL).
  - Filtra UUIDs inválidos por campo.
- `clearPendingSelection()`: remove todas as `PENDING_KEYS` de uma vez.
- `clearPendingSelectionFor(contactId)`: limpa só se `contact_id` armazenado bater (uso defensivo após consumir).

### 2. `BoardChatSidePanel.tsx` — escrita

No clique de "Abrir no Chat":
- Substituir os três `sessionStorage.setItem` por uma única chamada `setPendingSelection({ contactId, queueId, conversationId })`.
- Só navegar se `conv?.contactId` existir; caso contrário, `navigate('/chat')` sem pending.

Ao desmontar o `ScopedChat` ou fechar o Sheet **sem** ter clicado em "Abrir no Chat", garantir que o helper **não** seja chamado (escrita só acontece no botão). Nada a fazer aqui além de remover writes diretos.

### 3. `ChatPage.tsx` — consumo unificado

Substituir os dois `useEffect` atuais (fila e contato separados) por **um único efeito sequencial**:

```text
on mount / isReady change:
  pending = readPendingSelection()
  if !pending: return
  if pending.queueId && selectedQueue?.id !== pending.queueId:
     fetch queue row
     if not found OR is_deleted OR sem acesso (useUserQueueAccess):
        clearPendingSelection(); toast warn; return
     setSelectedQueue(...)
     return  // espera próximo tick com queue aplicada
  if !isReady || contacts not loaded yet: return
  selectContact(pending.contactId)
  clearPendingSelection()
```

Detalhes:
- Buscar `queue_access` via hook já existente (`useUserQueueAccess`) e validar antes de aplicar.
- Se `queue` retornar `is_deleted = true` ou `null`, limpar pending e exibir `toast` informativo ("Conversa indisponível").
- Adicionar listener `window.addEventListener('beforeunload', clearPendingSelection)` no `ChatPageContent` (cleanup ao sair).
- Adicionar `useEffect` de cleanup no unmount do `ChatPageContent` que **não** limpa (para permitir consumo após navegação), mas o TTL de 60s cobre o caso de pending órfão.

### 4. Edge cases cobertos

| Cenário | Comportamento |
|---|---|
| Usuário clica em "Abrir no Chat" no card A, depois B antes de `/chat` montar | Escrita do B sobrescreve A integralmente (clear + set). |
| Usuário fecha o Sheet sem clicar | Nada é gravado. |
| Pending antigo de sessão anterior | TTL 60s descarta ao ler. |
| `queueId` aponta para fila excluída / sem acesso | Limpa, toast, não seleciona contato. |
| `contactId` inválido (UUID malformado) | Descartado na leitura, retorna `null`. |
| `/chat` recebe pending mas `contacts` ainda não carregou | Efeito espera (`return`) e roda de novo quando `contacts.length` mudar. |
| Usuário navega `/chat` → CRM → `/chat` rapidamente | Como pending foi limpo após consumo, segunda visita ignora. |

### 5. Fora de escopo

- Não mexer em `WhatsAppDataContext` nem na hidratação de `selectedConversation`/`selectedContact` (já corrigidos).
- Sem mudanças de schema, RLS ou Edge Functions.

## Arquivos

- **novo:** `src/lib/chat/pendingSelection.ts`
- **editar:** `src/pages/crm-builder/components/deals/BoardChatSidePanel.tsx` (somente bloco do botão "Abrir no Chat")
- **editar:** `src/pages/chat/ChatPage.tsx` (substitui os dois `useEffect` de pending)
