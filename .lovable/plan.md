Adicionar borda de 1px e espaçamento de 1px entre os itens da lista de chat

## Objetivo
Aplicar uma borda de 1px e um espaçamento de 1px entre as divs de cada item da lista de conversas (ChatList), deixando a visualização mais definida e alinhada.

## Escopo
- Alteração visual pontual no frontend.
- Componente afetado: `src/components/chat/ChatList.tsx`.
- O wrapper absoluto de cada item virtualizado (`<div key={virtualItem.key} ...>`) deve receber a borda e o espaçamento.

## Passos
1. No arquivo `src/components/chat/ChatList.tsx`, localizar o wrapper `<div key={virtualItem.key} ...>` que envolve `<ChatContactItem>` (por volta da linha 1744).
2. Adicionar classes de borda ao wrapper: `border border-border/50` (ou `border-border` conforme contraste atual) e cantos arredondados leves (`rounded-md`).
3. Adicionar espaçamento entre os itens: aplicar `m-[1px]` ou `mb-[1px]` no wrapper, de forma que o virtualizer `measureElement` consiga medir corretamente a altura total incluindo o espaçamento.
4. Garantir que o layout continue funcionando no virtualizador (os itens são absolutamente posicionados).
5. Validar o build e visualizar o preview para confirmar que a borda e o espaçamento aparecem sem quebrar o scroll ou a seleção.

## Não incluso
- Não alterar o componente `ChatContactItem` internamente.
- Não modificar cores, sombras, tipografia ou outros aspectos visuais da lista.
- Não alterar dados ou comportamento da lista (filtros, ordenação, seleção).
