

## Diagnóstico (analisando as 4 imagens)

**Imagem 1 (problema atual):** Texto da última mensagem ("*NOTIFICAÇÃO DE CRIPTOGRAFIA* *Lead:* 5547961...") ultrapassa a borda direita do sidebar — não está sendo truncado corretamente. Pills (`AGENTE PRINCIPAL`, `+4h8m`, `NÃO ATRIBUÍDO`) também extrapolam.

**Imagem 2 (referência WhatsApp Web):** 
- Nome à esquerda + horário à direita (alinhados na linha 1)
- Preview de mensagem truncado com `...` antes da borda
- Badge verde de não lidas (número) na direita, alinhado abaixo do horário
- Espaçamento generoso do badge à borda direita (~16px)
- Largura do sidebar ~400px confortável

**Imagem 3 (problema):** Aparece uma barra de rolagem vertical no `<body>` da página inteira (lado direito do navegador) — o ChatPage está estourando a altura da viewport (`100vh - 4rem` provavelmente está somando padding extra).

**Imagem 4 (problema):** Dentro do chat aberto há **duas barras de rolagem verticais** — uma do `ScrollArea` interno das mensagens e outra do container pai. Isso indica overflow duplo.

**Badge de não lidas:** No print 1 não vejo o badge vermelho ao lado direito da mensagem da Maria/Saulo, mesmo havendo `unread_count`. Possível causa: o badge está sendo cortado pelo overflow ou está fora do flexbox por falta de espaço (texto ocupa 100% e empurra para fora).

## Plano de correção UX/UI

### 1. ChatContactItem — Truncamento e badge de não lidas (estilo WhatsApp Web)

Em `src/components/chat/ChatContactItem.tsx`:

- **Linha 1 (nome + horário):** garantir `min-w-0` no nome para o `truncate` funcionar dentro do flex, horário com `flex-shrink-0`.
- **Linha 2 (preview + badge unread):** 
  - Container `flex items-center gap-2 min-w-0`
  - Preview com `flex-1 min-w-0 truncate` (uma única linha, reticências)
  - Badge vermelho `flex-shrink-0` à direita, sempre visível quando `unread_count > 0`
  - Aumentar margem direita do badge (`mr-1` → respiração tipo WhatsApp)
- **Linha 3 (pills):** adicionar `min-w-0 overflow-hidden` no container e limitar pills visíveis (truncar com `...` extra ou esconder excedentes via `flex-wrap` controlado). Reduzir tamanho dos pills (`text-[9px]` já está ok, validar `max-w-[120px] truncate` em cada pill).
- **Container raiz do botão:** adicionar `min-w-0 overflow-hidden` para evitar que conteúdo force o sidebar a expandir.

### 2. ChatList — Largura e contenção do sidebar

Em `src/components/chat/ChatList.tsx`:
- Garantir `w-full min-w-0 overflow-hidden` no container raiz para que nada ultrapasse a largura definida pelo `ChatContainer`.
- Validar que o sidebar tem largura adequada (~384px / `w-96`) — manter como está, apenas garantir que conteúdo respeite.

### 3. ChatPage — Eliminar barra de rolagem da página (Imagem 3)

Em `src/pages/chat/ChatPage.tsx`:
- Atual: `h-[calc(100vh-4rem)] w-full overflow-hidden -mx-4 sm:-mx-6 -mb-4 sm:-mb-6`
- Problema: o cálculo `100vh - 4rem` não está descontando padding do layout pai, e os `-mx`/`-mb` negativos podem estar criando overflow horizontal.
- Correção: usar `h-[calc(100dvh-4rem)]` (dvh = dynamic viewport, mais preciso em mobile/desktop), adicionar `overflow-hidden` no `<html>`/`<body>` apenas para esta rota via classe no container, e validar que o layout pai (Layout.tsx) não está aplicando padding-bottom que somado estoura.
- Alternativa mais segura: investigar `src/components/Layout.tsx` para entender o wrapper e aplicar `overflow-hidden` no nível certo.

### 4. ChatContainer / ChatMessages — Eliminar dupla barra de rolagem (Imagem 4)

- Investigar `src/components/chat/ChatContainer.tsx` e `ChatMessages.tsx`.
- Garantir que apenas **um** elemento na coluna de mensagens tenha `overflow-y-auto` (o `ScrollArea` das mensagens). 
- O container pai deve ser `flex flex-col h-full overflow-hidden`.
- Header e input fixos com `flex-shrink-0`, área de mensagens com `flex-1 min-h-0 overflow-hidden` envolvendo o `ScrollArea`.

### 5. Validação do unread badge

Após corrigir o truncamento, o badge vermelho voltará a aparecer porque terá espaço reservado (`flex-shrink-0`). Confirmar que `contact.unread_count > 0` está chegando corretamente (já validado em mensagens anteriores — o realtime incrementa).

## Arquivos a editar

1. `src/components/chat/ChatContactItem.tsx` — truncamento, badge unread, pills
2. `src/components/chat/ChatList.tsx` — `min-w-0 overflow-hidden` no container
3. `src/pages/chat/ChatPage.tsx` — altura/overflow corretos
4. `src/components/chat/ChatContainer.tsx` — investigar e ajustar overflow
5. `src/components/chat/ChatMessages.tsx` — garantir único scroll

## Resultado esperado

- Sidebar: nomes, mensagens e pills truncados com `...` antes da borda; badge vermelho de não lidas sempre visível com respiro à direita (estilo WhatsApp Web da Imagem 2).
- Página `/chat`: sem barra de rolagem do navegador (Imagem 3 resolvida).
- Conversa aberta: apenas uma barra de rolagem na área de mensagens (Imagem 4 resolvida).

