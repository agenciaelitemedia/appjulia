## Ajustes nas abas e no filtro de modo do `/chat`

Arquivo único: `src/components/chat/ChatList.tsx`.

### 1. Reordenar as abas de status (linha ~1066)

A aba **Resolvidas/Encerradas** passa a ser a **primeira**. Nova ordem do array que alimenta o `.map`:

1. `resolved_closed` — ícone `CheckCheck` (icon-only, com tooltip "Resolvidas / Encerradas").
2. `pending` — "Em Abertos".
3. `open` — "Em Atendimento".

### 2. Contadores sempre visíveis e independentes da aba

Hoje o badge só renderiza dentro de cada `<button>` da aba ativa quando `count >= 0`, mas o cálculo (`pendingConvCount` / `openConvCount` / `closedConvCount`) já é feito sobre `conversationsForBadges`, que ignora o `conversationStatusFilter`. Vamos:

- Garantir que o `<span>` do badge **sempre renderize** (remover qualquer condicional `count > 0` se houver) e exibir `0` quando não houver conversas — assim o usuário enxerga o número real de cada categoria mesmo na aba selecionada.
- Manter o estilo de cor diferenciado (preenchido em `bg-primary` quando a aba está ativa, `bg-muted` quando inativa) para reforçar a aba selecionada sem esconder os outros contadores.
- Confirmar que `conversationsForBadges` continua sendo a fonte (já ignora status); nenhuma mudança nos memos é necessária além do que já existe.

Tecnicamente, como não existem mais pills de status acima da lista, os badges das abas passam a ser a **única referência visual** de quantas conversas existem em cada bucket — por isso o badge precisa ser persistente.

### 3. Destaque do filtro de modo (Todos / Julia / Humano)

No bloco `ToggleGroup` (linhas ~926-969), reforçar visualmente o item selecionado, para que fique nítido qual modo está ativo:

- Aumentar o item ativo: `data-[state=on]:ring-2 data-[state=on]:ring-offset-1 data-[state=on]:scale-105 data-[state=on]:shadow-sm`.
- Cores ativas mais saturadas (mantendo a paleta existente): 
  - **Todos**: `data-[state=on]:bg-foreground data-[state=on]:text-background data-[state=on]:ring-foreground/40`.
  - **Julia**: `data-[state=on]:bg-green-500 data-[state=on]:text-white data-[state=on]:ring-green-500/40`.
  - **Humano**: `data-[state=on]:bg-amber-500 data-[state=on]:text-white data-[state=on]:ring-amber-500/40`.
- Itens não selecionados permanecem com `bg-background text-muted-foreground` para contraste.
- Adicionar um pequeno rótulo dinâmico (texto curto) ao lado dos ícones — por exemplo, à direita do `ToggleGroup`, um `<span className="text-[11px] font-medium text-foreground/80">{modeLabel}</span>` onde `modeLabel` mapeia `all → 'Todos'`, `julia → 'Julia IA'`, `human → 'Humano'`. Isso deixa explícito o modo ativo sem depender só da cor.

### Observações

- Nenhuma alteração em `WhatsAppDataContext`, em hooks ou em queries.
- Mudanças puramente de UI/ordem; lógica de filtro de status continua sendo a aba (`setConversationStatusFilter`).
- Manter tokens semânticos do design system; usar variantes Tailwind já presentes.
