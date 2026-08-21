Ajuste fino visual da lista de chat — redução da borda e espaçamento

Objetivo: refinar a separação entre os cards da lista de conversas, deixando a borda e o espaçamento mais sutis.

Escopo: apenas o componente `src/components/chat/ChatList.tsx`, no trecho que envolve cada item virtualizado da lista de contatos.

Mudanças propostas:
- Espaçamento externo: alterar o wrapper virtualizado de `px-[2px] pb-[2px]` para `px-[1px] pb-[1px]`.
- Espessura da borda: alterar a borda do card interno de `border-[3px] border-foreground/30` para `border-[2px] border-foreground/30`.
- Manter a cor `border-foreground/30` (token semântico) para contraste consistente nos temas claro e escuro.
- Manter `rounded-md overflow-hidden` e o restante da estrutura inalterados.

Validação: build passando e verificação visual no preview da lista de chat.