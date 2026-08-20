# Refino visual do Chat — só cores e efeitos

Escopo: nenhuma mudança de disposição (larguras, colunas, ordem, tamanhos de fonte/estrutura). Apenas paleta, contraste, bordas, sombras, transições e vidro — alinhando o Chat à estética do /login e ao sistema de tokens já criado (`aj-*`).

## Crítica do estado atual (o que está feio ou incoerente)

1. **Bolha de mensagem enviada usa `bg-green-100 / dark:bg-green-900/30`** — verde WhatsApp cru, fora da marca (ameixa/magenta) e sem relação com nenhum token. No dark fica um verde sujo de contraste fraco.
2. **Superfícies chapadas**: header do chat (`border-b bg-background`), input (`border-t bg-background`) e lista (`bg-background`) são planos, com borda cinza dura de 1px. O resto do app já usa vidro + filete degradê; o Chat ficou como uma ilha "template".
3. **Cores hardcoded soltas**: `bg-slate-100 text-slate-900`, `bg-blue-600 text-white`, `bg-green-50/green-700/green-500`, `bg-gray-700 ... dark:bg-gray-200` nos filtros e badges. Não respondem ao tema, quebram no dark e criam 4 famílias de cor concorrendo na mesma tela.
4. **Filtros de status tingindo a lista inteira** (`bg-amber-50` / `bg-emerald-50` com overrides `[&_.bg-background]`) — hack agressivo, satura o painel e mata a hierarquia; o item selecionado deixa de se destacar.
5. **Semáforo de estados inconsistente**: pendente=amarelo, aberto=emerald, resolvido=blue em um lugar; em outro os mesmos estados aparecem em green-50/green-700. Sem uma escala única de "status".
6. **Item ativo da conversa sem âncora de marca** — o selecionado usa cinza (`bg-muted`), então em uma lista longa o olho não encontra a conversa aberta.
7. **Separador de data e avatar fallback** genéricos (`bg-muted`, `bg-primary/10`) — perdem-se no fundo.
8. **Hover/foco**: ações da bolha só usam `opacity-0 → 100` sem transição de cor; muitos botões-ícone sem anel de foco padronizado (o `.aj-focus-ring` já existe e não é usado aqui).
9. **Sem profundidade nenhuma nas bolhas** — borda `border-border/50` e zero elevação; a timeline lê como lista de divs.

## O que será feito

### Tokens (index.css) — aditivo, sem alterar tokens globais existentes
- Novos tokens semânticos de chat: `--chat-bubble-out`, `--chat-bubble-out-border`, `--chat-bubble-in`, `--chat-canvas`, para claro e escuro.
- Escala única de status (`--status-pending`, `--status-open`, `--status-resolved`, `--status-closed`) para acabar com amarelo/verde/azul duplicados.
- Utilitários novos: `.aj-chat-canvas` (fundo da timeline com glow radial sutil da marca, bem baixo), `.aj-chat-bar` (header/input em vidro: `backdrop-blur`, gradiente vertical suave, hairline degradê em vez de borda cinza), `.aj-bubble-out` / `.aj-bubble-in` (gradiente sutil + hairline + sombra 1px), `.aj-chat-item-active` (pílula com faixa de marca à esquerda e brilho interno).

### Aplicação
- `MessageBubble.tsx`: substituir verde por `.aj-bubble-out` (ameixa/magenta translúcido, texto em `foreground`, contraste AA nos dois temas) e `.aj-bubble-in`; ações com transição de cor e `.aj-focus-ring`.
- `ChatMessages.tsx`: `.aj-chat-canvas` no scroller; separador de data em vidro (`backdrop-blur` + hairline) em vez de `bg-muted`.
- `ChatHeader.tsx`: `.aj-chat-bar`; badges de canal e de status migram para a escala de status por token; trocar `bg-slate-100`, `bg-blue-600`, `bg-green-50/700` por tokens; avatar fallback com gradiente da marca.
- `ChatInput.tsx`: `.aj-chat-bar`; barras de citação/nota mantêm o código de cor semântico (info/dúvida/urgente) mas passando por tokens de status, com opacidades coerentes no dark; botão de envio herda o primário vitrificado já existente.
- `ChatList.tsx`: remover o tingimento global do painel por filtro — o estado passa a ser sinalizado só no chip do filtro e num hairline no topo da lista; chips de filtro usando tokens (fim de `bg-gray-700 / dark:bg-gray-200`, `bg-green-600`); busca com foco de marca.
- `ChatContactItem.tsx`: item ativo com `.aj-chat-item-active`; badge de não-lidas na cor da marca (mantendo verde apenas onde ele significa "WhatsApp/canal", não "selecionado"); faixa de não-respondido com opacidades corrigidas no dark.

### Verificação
Checar contraste AA de texto em bolhas, chips e badges nos dois temas, e revisar em captura antes/depois. Nenhum arquivo de layout, hook ou lógica é tocado.

## Nota técnica
Como o `/chat` exige sessão autenticada, a validação visual será feita numa página de sandbox temporária renderizando bolhas/chips/header com os novos utilitários nos dois temas, removida ao final (mesmo procedimento usado no refino dos kanbans).
