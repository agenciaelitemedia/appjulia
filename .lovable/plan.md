## Diagnóstico

O **403 da imagem do WhatsApp não trava nada** — é só um avatar de contato que o servidor da Meta bloqueou (link expirado/CDN). O `<img>` simplesmente não pinta.

O que **realmente travou** o carregamento foi um erro de runtime que eu introduzi na refatoração do `useChatContactsByIds`:

```
TypeError: Cannot read properties of undefined (reading 'next')
  at useQueries → useChatContactsByIds → ChatList
```

Causa: `useQueries({ queries: [] })` com array vazio dispara um bug do React Query nessa versão quando combinado com `useMemo` que retorna nova referência. Quando o usuário entra no /chat sem `missingContactIds`, o array de chunks é `[]` e o hook quebra.

## Plano

### 1. Corrigir `useChatContactsByIds` (bloqueante)

- Garantir que `useQueries` sempre receba pelo menos uma query "no-op" desabilitada (`enabled: false`) quando não há ids, em vez de `queries: []`.
- Estabilizar a `queryKey` por chunk (já está) e memoizar o array de queries para não recriar a cada render.
- Manter a API atual `{ data, isLoading, isFetching, error }` para não quebrar o `ChatList`.

### 2. Tornar avatar resiliente a 403

- Em `ChatContactItem` (e onde o `<Avatar>` do contato é renderizado), usar `onError` no `<AvatarImage>` para limpar a `src` e cair no `AvatarFallback` (iniciais) em vez de continuar tentando.
- Sem retry — se a Meta devolveu 403, o link está morto pra sempre.

### Arquivos
- `src/hooks/useChatContactsByIds.ts` — fix do crash.
- `src/components/chat/ChatContactItem.tsx` — fallback gracioso no avatar.

### Não muda
- Lógica de paginação 1.000 + 200 (já implementada e correta).
- Fluxo de classificação Julia/Humano.
