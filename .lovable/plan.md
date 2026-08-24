# Auto-carregar mais conversas ao rolar a lista (JulIA Chat)

## O que está acontecendo

O gatilho de paginação (o "sentinela" observado no fim da lista) só existe no DOM **depois** que a lista já tem linhas: em `JuliaChatList.tsx` ele está dentro do bloco renderizado apenas quando `feed.rows.length > 0`.

O observador de rolagem, porém, é criado uma única vez, quando a aba fica visível — nesse momento a lista ainda está vazia (carregando), o sentinela não existe e o efeito sai sem observar nada. Como ele não é recriado quando as linhas chegam, a aba aberta na entrada nunca passa a observar o fim da lista: rolar até o fim não dispara `loadMore`.

Efeito colateral observado: ao trocar de aba e voltar, a paginação volta a funcionar (aí o efeito roda com a lista já preenchida) — o que confirma o diagnóstico.

Há ainda um segundo ponto que atrapalha a percepção de "carregou mais": as revalidações silenciosas automáticas recarregam sempre a **primeira** página (offset 0) e substituem as linhas, então tudo que havia sido paginado é cortado de volta para 30 itens.

## Correção

1. Sentinela sempre presente e sempre observado
   - Mover o sentinela para fora do bloco condicional (fica ao final do container de rolagem, independente de haver linhas).
   - Recriar o observador quando a lista deixa de estar vazia e quando `hasMore` muda, e verificar imediatamente após cada página se o sentinela continua visível (caso a lista curta não gere novo evento de interseção).

2. Rede de segurança por rolagem
   - Além do observador, disparar `loadMore` quando o container chegar perto do fim (margem de ~240px), cobrindo casos em que o observador não emite evento.

3. Revalidação não perde as páginas já carregadas
   - Nas revalidações silenciosas, recarregar o mesmo volume já exibido (múltiplo de 30 conforme a quantidade de linhas atual) em vez de voltar para 30, preservando a posição de leitura.

## Detalhes técnicos

- `src/modules/julia-chat/components/JuliaChatList.tsx`: sentinela fora do condicional; efeito do `IntersectionObserver` com deps `[visible, feed.rows.length > 0, feed.hasMore]`; handler `onScroll` no container como fallback; ambos passando pelo mesmo `loadMoreRef.current()` (que já é protegido contra chamadas concorrentes por `loading/loadingMore/hasMore`).
- `src/modules/julia-chat/hooks/useJuliaChatFeed.ts`: em `load(0, 'replace', { silent: true })` usar `limit = Math.max(PAGE_SIZE, rowsRef.current.length)` (limitado ao teto de 200 aceito pela edge function) e manter `has_more` coerente com esse limite.
- Nenhuma mudança na edge function `julia-chat-list-feed` nem no banco.

## Validação

- Abrir `/chat`, rolar a lista da aba inicial até o fim: novas conversas aparecem sem trocar de aba.
- Repetir nas abas Aguardando / Em atendimento / Resolvidos.
- Deixar a lista paginada aberta por ~30s e confirmar que a revalidação automática não corta a lista de volta para 30 itens.
