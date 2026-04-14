

## Plano: Ajustar padding, barra vertical e layout da página

### Problemas identificados

1. **Barra vertical visível** — `border-l-3` no `InactiveLeadItem` cria uma borda lateral visível (cinza/transparente) em todos os itens, mesmo os não selecionados
2. **Padding excessivo à esquerda** — `px-4` + `border-l-3` empurra o avatar para dentro demais
3. **Header com espaçamento grande** — `p-3` no header da lista ocupa espaço vertical desnecessário

### Mudanças

#### 1. `InactiveLeadItem.tsx`
- Trocar `border-l-3` por `border-l-2` (mais sutil, padrão do chat)
- Reduzir padding: `px-4` → `px-3`
- Item não selecionado: usar `border-l-transparent` (sem borda visível)
- Item selecionado: manter `border-l-primary`

#### 2. `InactiveLeadsList.tsx`
- Reduzir padding do header: `p-3` → `px-3 pt-2 pb-2`
- Compactar espaçamento vertical: `space-y-2` → `space-y-1.5`

#### 3. `HumanSupportPage.tsx`
- Nenhuma mudança necessária (largura w-96 já está correta)

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `InactiveLeadItem.tsx` | Corrigir border-l e reduzir padding |
| `InactiveLeadsList.tsx` | Compactar header |

