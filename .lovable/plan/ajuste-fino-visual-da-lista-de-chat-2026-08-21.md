Ajuste fino visual da lista de chat

Objetivo: tornar visível a borda entre os cards da lista de conversas, aumentando a espessura e o espaçamento, com uma cor que contraste bem nos temas claro e escuro.

Escopo: apenas o componente `src/components/chat/ChatList.tsx`, no trecho que envolve cada item virtualizado da lista de contatos.

Mudanças propostas:
- Espaçamento externo: alterar o wrapper virtualizado de `px-[1px] pb-[1px]` para `px-[2px] pb-[2px]`.
- Espessura da borda: alterar a borda do card interno de `border border-border/50` para `border-[3px] border-foreground/30`.
- Cor: usar `border-foreground/30` (token semântico) para garantir contraste forte tanto no tema claro quanto no escuro, sem depender de uma cor literal ou hardcoded.
- Manter `rounded-md overflow-hidden` e o restante da estrutura inalterados.

Validação: build passando e verificação visual no preview da lista de chat.