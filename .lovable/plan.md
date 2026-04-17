
## Ajuste do plano (estilo WhatsApp Web)

Layout final do `ChatContactItem`:

```text
┌─────────────────────────────────────────────────┐
│ [Avatar]  Nome do contato              há 5 min │ ← linha 1: nome (esq) + tempo (dir)
│           Última mensagem truncada...      (3)  │ ← linha 2: preview (esq) + badge unread (dir)
│           [FILA] [SLA 12min] [JOÃO]             │ ← linha 3: tags na ordem fila → SLA → atribuído
└─────────────────────────────────────────────────┘
```

## Mudanças em `src/components/chat/ChatContactItem.tsx`

1. **Linha 1** — `flex justify-between`:
   - Esquerda: nome do contato (truncado)
   - Direita: `formattedTime` (sempre visível, `flex-shrink-0`)

2. **Linha 2** — `flex justify-between items-center gap-2`:
   - Esquerda: `<MessagePreview>` da última mensagem (`truncate`, `min-w-0`, `flex-1`)
   - Direita: badge vermelho redondo de `unread_count` (somente quando `> 0`, `flex-shrink-0`)

3. **Linha 3** — tags na ordem exata:
   - `[FILA]` (queueName) → `[SLA]` (SlaBadge) → `[ATRIBUÍDO]` (assignedAgentName / "NÃO ATRIBUÍDO")
   - Refatorar `ConversationBadges` para aceitar slots ordenados, ou montar inline na ordem correta
   - Manter badges extras (prioridade, tags da conversa) ao final

4. **Garantir visibilidade do badge unread**:
   - Tamanho mínimo `min-w-[20px] h-5`, `bg-red-500 text-white`, `rounded-full`, fonte bold
   - `flex-shrink-0` para nunca ser comprimido

## Arquivo a editar

- `src/components/chat/ChatContactItem.tsx` (apenas reestruturação do JSX e da função `ConversationBadges`)
