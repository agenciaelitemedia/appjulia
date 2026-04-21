

## Corrigir crash no /chat — `Cannot read properties of undefined`

### Causa raiz

No último diff aplicado em `src/contexts/WhatsAppDataContext.tsx` (`refreshConversationTags`), quando a função é chamada **sem `conversationId`** (refresh global), o estado `conversationTagsMap` é **substituído** por um novo objeto `map` que contém **apenas `conversation_id`s que possuem tags**. Conversas sem tags deixam de existir como chave no mapa.

Além disso, em `deleteTag` (linha 524-530), o código faz:
```ts
next[convId] = next[convId].filter(...)
```
Sem proteção contra `undefined` — se `next[convId]` existisse antes mas fosse limpo, o `.filter` quebra. Mais importante: o erro reportado é:

> `Cannot read properties of undefined (reading '30cf33b2-f841-407d-ac11-a517212998b7')`

Isso indica que **algum código está acessando `algumObjeto[conversationId]` onde `algumObjeto` é `undefined`**. O ID `30cf33b2-...` é uma `conversation.id`. O ponto exato (em `ChatList.tsx:743`) é:
```tsx
convTags={conv ? conversationTagsMap[conv.id] : undefined}
```

Isso por si só não quebraria, **a menos que `conversationTagsMap` esteja `undefined`** no value do contexto. Olhando o build error reportado também:

> Type ... is missing the following properties from type 'ExtendedContextValue': updateTag, deleteTag, **conversationTagsMap**, refreshConversationTags

Confirma: o `value={...}` do `WhatsAppDataContext.Provider` **não está expondo `conversationTagsMap`**, então o consumidor recebe `undefined` e quebra ao indexar.

### Correção

**Arquivo: `src/contexts/WhatsAppDataContext.tsx`**

1. No objeto `value` do `<WhatsAppDataContext.Provider>` (próximo da linha 1644), incluir as 4 propriedades faltantes:
   - `conversationTagsMap`
   - `refreshConversationTags`
   - `updateTag`
   - `deleteTag`

2. Em `deleteTag`, blindar o filter contra `undefined`:
   ```ts
   next[convId] = (next[convId] || []).filter(t => t.id !== tagId);
   ```

3. Em `ChatList.tsx:743` e `ChatHeader.tsx:250`, adicionar fallback defensivo:
   ```tsx
   convTags={conv ? (conversationTagsMap?.[conv.id] || []) : undefined}
   ```
   ```tsx
   {selectedConversation && (conversationTagsMap?.[selectedConversation.id] || []).slice(0, 3).map(...)}
   ```

### Observação sobre o build error de `bcryptjs` em `db-query/index.ts`

É um erro pré-existente da edge function `db-query` (não relacionado a este bug do chat). Não será tocado nesta correção — é independente e não afeta o crash do `/chat`.

### Arquivos alterados

- `src/contexts/WhatsAppDataContext.tsx` — expor `conversationTagsMap`, `refreshConversationTags`, `updateTag`, `deleteTag` no `value` do Provider; blindar `deleteTag`.
- `src/components/chat/ChatList.tsx` — fallback `?.[]` ao indexar `conversationTagsMap`.
- `src/components/chat/ChatHeader.tsx` — fallback `?.[]` ao indexar `conversationTagsMap`.

### Resultado esperado

A página `/chat` deixa de crashar. As tags continuam sendo exibidas e atualizadas normalmente em conversas, e o refresh global não apaga mais conversas do mapa.

