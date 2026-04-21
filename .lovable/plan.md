

## Bug: Chat com reload/piscar contínuo

### Causa raiz

No `ChatPage.tsx` o `useEffect` inicial depende de `[loadContacts, selectContact]`. Mas `selectContact` no `WhatsAppDataContext` é recriada sempre que `contacts` ou `conversations` mudam (deps: `[getOrCreateConversation, contacts, conversations, markAsRead, user?.name, user?.id]`).

Resultado: realtime/polling atualiza `contacts` → `selectContact` ganha nova referência → effect dispara → `loadContacts()` roda de novo → `contacts` atualiza → loop infinito → lista pisca.

Foi introduzido na implementação do módulo Contatos, quando adicionei `selectContact` ao array de dependências para suportar `chat_pending_contact_id`.

### Correção

Em `src/pages/chat/ChatPage.tsx`, fazer o effect rodar **apenas uma vez no mount** usando refs para acessar as funções mais recentes sem entrar no array de deps:

```tsx
const loadContactsRef = useRef(loadContacts);
const selectContactRef = useRef(selectContact);
useEffect(() => { loadContactsRef.current = loadContacts; }, [loadContacts]);
useEffect(() => { selectContactRef.current = selectContact; }, [selectContact]);

useEffect(() => {
  (async () => {
    await loadContactsRef.current();
    const pending = sessionStorage.getItem('chat_pending_contact_id');
    if (pending) {
      sessionStorage.removeItem('chat_pending_contact_id');
      selectContactRef.current(pending);
    }
  })();
}, []); // mount once
```

### Arquivo alterado

- `src/pages/chat/ChatPage.tsx` — refs + effect com deps `[]`.

Sem mudanças de schema, sem outras alterações.

