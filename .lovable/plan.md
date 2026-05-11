## Situação atual

A virtualização da lista de conversas **já está implementada** em `src/components/chat/ChatList.tsx` usando `@tanstack/react-virtual`:

- `useVirtualizer` configurado (linha 1025) com `estimateSize: 102`, `overscan: 8` e `measureElement` para altura dinâmica.
- Container scroll (`listRef`) com `overflow-y-auto`; spacer com `getTotalSize()`; apenas itens visíveis renderizados via `getVirtualItems()` (linhas 1495–1544).
- Resultado: com 1.000+ conversas em memória, apenas ~20 nós ficam no DOM por vez.

Ou seja, o custo de render por scroll já está minimizado. Não há trabalho a fazer no requisito original.

## Otimizações opcionais (se houver lentidão percebida)

Posso aplicar uma ou mais destas afinações pontuais — todas pequenas, sem mudar arquitetura:

1. **Memoizar `ChatContactItem`** com `React.memo` + comparador raso. Hoje cada scroll re-renderiza props derivadas (queue, alias, stage, tags) mesmo quando nada mudou para aquele contato.
2. **Pré-computar `displayConvsByContact`, `aliasMap`, `stageByPhone`** em `useMemo` estável (verificar se já estão; caso reconstruam por render, estabilizar dependências).
3. **Aumentar `overscan` para 12** em telas altas para reduzir flicker ao rolar rápido (custo baixo).
4. **`getItemKey: (i) => displayContacts[i].id`** no virtualizer, garantindo reuso de DOM por contato (hoje a key vem de `virtualItem.key` que é por índice).

## Próximo passo

Confirme se quer:
- (A) apenas a verificação acima (nada a fazer), ou
- (B) aplicar as otimizações 1–4 (ou um subconjunto).