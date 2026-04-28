## Sincronização e otimização do `ChatList`

### 1. Sincronização entre contagens das abas e lista exibida

A contagem das abas e a lista visível já compartilham a mesma fonte (`visibleContacts` + `statusByContact`), mas há dois pontos onde podem ficar defasadas durante interações rápidas:

- **Ordenação repetida** de `conversations` em duas memos diferentes (`convMetaByContact` e `statusByContact`) cria janelas onde uma atualiza antes da outra.
- **`searchQuery`** vem direto do estado, sem `useDeferredValue` — durante digitação rápida + troca de aba o filtro local de contagem pode rodar em frames diferentes da lista.

**Solução**: derivar **lista renderizada** e **contagens** num único `useMemo` compartilhado, garantindo cálculo atômico no mesmo render.

### 2. Otimizações de custo em `useMemo`

Mudanças em `src/components/chat/ChatList.tsx`:

**a) Sort único de `conversations`** — substituir as duas cópias `[...conversations].sort(...)` (em `convMetaByContact` e `statusByContact`) por um `sortedConversations` memoizado:

```ts
const sortedConversations = React.useMemo(() => {
  const withTs = conversations.map((c) => ({
    c,
    ts: Date.parse(c.updated_at || c.created_at || '') || 0,
  }));
  withTs.sort((a, b) => b.ts - a.ts);
  return withTs.map((x) => x.c);
}, [conversations]);
```
Ganhos: 1 sort em vez de 2; sem `new Date()` por comparação (Date.parse 1x por item).

**b) Contagens em passada única** — substituir `tabFilteredForCounts` + `pendingConvCount` + `openConvCount` (3 iterações em sequência) por um único `for` que filtra aba/busca e incrementa os dois contadores no mesmo loop, retornando `{ pendingConvCount, openConvCount }`. Garante que ambos contadores são produzidos no mesmo render que a lista visível.

**c) `useDeferredValue` em `searchQuery`** dentro do componente para que a digitação não trave a renderização e a lista + contadores recebam o mesmo valor diferido (mantém-se sincronizados):

```ts
const deferredSearch = React.useDeferredValue(searchQuery);
// usar deferredSearch tanto no cálculo dos counts quanto onde a lista é renderizada por busca
```

**d) Memoizar `lowercase` de busca** uma só vez em vez de chamar `.toLowerCase()` por contato.

**e) `slaStatusByContact`** já está bom; apenas trocar `evaluateSla` em loop por skip cedo quando `slaConfigs` não estiver definido (early return da memo).

### Arquivos editados
- `src/components/chat/ChatList.tsx`

### Resumo de impacto
- Mesma fonte de verdade para lista e contadores no mesmo render → sem defasagem ao alternar abas/filtros.
- ~50% menos trabalho em sort de conversations.
- 1 passada única em vez de 3 para derivar contadores.
- Digitação na busca não bloqueia a lista (deferred).
