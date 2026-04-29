
# Ajustes no /chat (revisado após análise do banco)

## Descoberta sobre o "prefixo"

Diferente do que o plano anterior assumiu, o texto `⚠️ *NOTIFICAÇÃO DE CRIPTOGRAFIA* ⚠️\n\n*Lead:* <fone>` **não é um prefixo** colocado antes da mensagem real. Investigação no `chat_messages.raw_payload`:

- O `raw_payload.content.text` (vindo direto do WhatsApp via UaZapi) **é exatamente esse texto e nada mais** (todos os registros têm 58 chars).
- Ocorre em `from_me=true` e `from_me=false`, originado do número `553488860163` (Escritório Lopes Bahia) — eles disparam essa "notificação de criptografia" como mensagem real do WhatsApp, provavelmente por automação interna.
- O nome `Escritorio Lopes Bahia` que aparecia "antes" no relato do usuário **não está no `text`** — vem do header da bolha (sender_name em grupos / metadata.sender_name) renderizado pelo `MessageBubble`.

Conclusão: não há nada para "remover do começo". O comportamento correto é **filtrar/ocultar a mensagem inteira** quando ela for apenas esse envelope, já que não carrega informação útil para o atendente.

---

## 1. Ocultar mensagens-envelope "NOTIFICAÇÃO DE CRIPTOGRAFIA"

### Detector (`src/lib/chat/envelopeFilter.ts` — novo)

```ts
const ENVELOPE_RE =
  /^\s*⚠️\s*\*?NOTIFICAÇÃO DE CRIPTOGRAFIA\*?\s*⚠️\s*\n+\s*\*?Lead:\*?\s*[\d+\s]+\s*$/i;

export function isEncryptionEnvelope(text?: string | null): boolean {
  if (!text) return false;
  return ENVELOPE_RE.test(text.trim());
}
```

### Aplicação

- **`src/components/chat/ChatMessages.tsx`**: ao montar a lista renderizada, descartar mensagens onde `isEncryptionEnvelope(message.text) && message.type === 'text' && !message.media_url`. Não exclui do banco — apenas oculta do UI.
- **`src/lib/chat/messagePreview.ts`** (`getMessagePreview`): se o texto bater no envelope, retornar string vazia para o caller decidir o fallback. No `WhatsAppDataContext.loadConversations` / preview da lista, quando o último texto for envelope, usar o penúltimo evento ou exibir `"Conversa iniciada"` como neutro.
- Sem migration. Mensagens já gravadas continuam no banco; apenas deixam de aparecer.

---

## 2. Assinatura do atendente (formato confirmado)

Antes do texto digitado, prefixar exatamente:

```
*Nome do Usuário:*
Mensagem digitada
```

### UX (`src/components/chat/ChatInput.tsx`)

- Novo botão toggle (ícone `PenLine`) ao lado dos demais, visível apenas quando `!noteMode`.
- Estado `signEnabled` com persistência em `localStorage` por usuário (`chat:signature:enabled:<userId>`), default `true`.
- Tooltip: `Assinar como "<nome do usuário>"` / `Assinatura desativada`.
- No `handleSend`, quando `signEnabled && user?.name && !noteMode`:
  ```ts
  const signed = `*${user.name}:*\n${messageText}`;
  ```
  Aplica também à `caption` em mídia. **Não** aplica em PTT/áudio nem em notas internas.

---

## 3. Filtro "Todas as filas" deve respeitar permissões

### Bug

Em `src/contexts/WhatsAppDataContext.tsx`:
- `loadConversations` e `loadConvCounts` já restringem por `activeQueueIds` (de `useAccessibleQueues`).
- `loadContacts` (linha ~246) e a subscription realtime de `chat_contacts` (linha ~1523) **não restringem** quando `currentQueueId` é `null` — mostram todas as filas do `client_id`.

### Correção

Em `loadContacts`:
```ts
if (currentQueueId) {
  query = query.eq('channel_source', currentQueueId);
} else if (activeQueueIds.length > 0) {
  query = query.in('channel_source', activeQueueIds);
} else {
  setContacts([]); return;
}
```
Adicionar `activeQueueIds` às deps do `useCallback`.

Na subscription realtime: descartar INSERT/UPDATE com `channel_source` fora de `activeQueueIds` quando `!currentQueueId`.

Resultado: usuário com acesso só a A/D/G vê apenas A/D/G ao escolher "Todas".

---

## 4. Aba "Em Atendimento" — não-admin vê só os seus

### Regra

Quando `conversationStatusFilter === 'open'` **e** `user.role` ∉ {`admin`, `colaborador`, `user`}, mostrar apenas conversas onde `assigned_to === user.name` (fallback `String(user.id)`).

### Onde aplicar

`src/components/chat/ChatList.tsx`, dentro de `applyClientFilters` e `baseForCounts`:

```ts
const isPrivilegedRole = ['admin','colaborador','user'].includes(user?.role || '');
const restrictToMine = !isPrivilegedRole && conversationStatusFilter === 'open';
if (restrictToMine) {
  result = result.filter(c => {
    const a = convMetaByContact.get(c.id)?.assignedTo;
    return !!a && (a === user?.name || a === String(user?.id));
  });
}
```

Aplicar também ao `baseForCounts` para o badge da aba refletir só o que o usuário pode ver. Aba "Em Aberto" (pending) continua mostrando o pool de não-atribuídos.

---

## Sequência de implementação

1. `loadContacts` + realtime respeitando `activeQueueIds` (item 3).
2. Filtro "só meus atendimentos" em `ChatList` (item 4).
3. Toggle de assinatura no `ChatInput` no formato `*Nome:*\n…` (item 2).
4. Filtro de envelope "NOTIFICAÇÃO DE CRIPTOGRAFIA" em `ChatMessages` + `messagePreview` (item 1).

Sem migrations, sem alterações em edge functions, sem mexer em dados gravados.

