
## Diagnóstico

Olhando a request mais recente nos network logs:

```
PATCH chat_contacts?id=eq.d1df9ee5-... { "unread_count": 0 }
```

Isso aconteceu **automaticamente** logo após o `loadMessages` (GET chat_messages). Ou seja, mesmo após removermos `markAsRead` do `selectContact`, **algum outro lugar ainda está zerando `unread_count` ao abrir/carregar mensagens**.

Suspeitos prováveis:
1. `loadMessages` em `WhatsAppDataContext.tsx` pode estar chamando `markAsRead` internamente.
2. Realtime subscription que dispara `markAsRead` quando a conversa está selecionada.
3. `ChatMessageList` / `ChatContainer` que dispara efeito ao montar para marcar como lida.
4. Trigger no banco em `chat_messages` SELECT (improvável — não há triggers).

Vou inspecionar:
- `src/contexts/WhatsAppDataContext.tsx` (loadMessages, realtime handlers, qualquer chamada residual a markAsRead)
- `src/components/chat/ChatContainer.tsx`
- `src/components/chat/ChatMessageList.tsx`
- `src/components/chat/ChatList.tsx`
- buscar todas as ocorrências de `markAsRead` e `unread_count: 0` no projeto

## Plano de correção

1. **Localizar** todos os pontos onde `unread_count` é zerado (PATCH com `unread_count: 0` ou chamadas a `markAsRead`).
2. **Remover** as chamadas automáticas que ocorrem ao:
   - selecionar contato
   - carregar mensagens
   - abrir o painel de mensagens
3. **Manter** a chamada a `markAsRead` **apenas** dentro do fluxo de "Assumir conversa" (`ChatHeader.handleTakeOver`).
4. **Validar** que `ChatContactItem` continua exibindo o badge vermelho quando `unread_count > 0` (já está correto).

## Ação concreta

Editar `src/contexts/WhatsAppDataContext.tsx` (e possivelmente `ChatContainer`/`ChatMessageList` se houver efeitos lá) para remover qualquer `markAsRead` ou update direto de `unread_count` que ocorra fora do fluxo de "Assumir".

Após implementar, validar:
- Receber nova mensagem de Saulo → badge vermelho aparece com contagem
- Clicar na conversa → mensagens carregam, **badge permanece**
- Clicar em "Assumir" → badge zera

## Arquivos a investigar/editar

- `src/contexts/WhatsAppDataContext.tsx` (principal suspeito — loadMessages e realtime)
- `src/components/chat/ChatContainer.tsx` (efeitos ao selecionar contato)
- `src/components/chat/ChatMessageList.tsx` (efeito ao montar)
- `src/components/chat/ChatList.tsx` (qualquer efeito ao clicar)
