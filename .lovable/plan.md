

## Plano: Corrigir Layout da Lista de Conversas — Atendimento Humano

### Problemas Identificados (da screenshot)

1. **Timestamps não aparecem** — o horário da última mensagem não está visível em nenhum item da lista
2. **Scrollbar horizontal nos filtros de período** — os badges "3 meses" está cortado, scrollbar aparente
3. **Stage badges ausentes** — nenhum item mostra o badge de fase do CRM
4. **Sem indicador de seleção** — falta borda lateral para indicar item selecionado (padrão Helena)

### Mudanças

#### `InactiveLeadItem.tsx`

- **Garantir timestamp visível**: mover o timestamp para uma posição fixa no canto superior direito com `shrink-0` e largura mínima, usando cor de urgência
- **Ajustar Row 1**: nome com `font-medium` truncado + timestamp sempre visível à direita
- **Row 2**: telefone formatado (sempre visível, mesmo sem `contact_name`) + stage badge à direita
- **Seleção**: adicionar `border-l-2 border-l-primary` quando selecionado
- **Remover border-b do content div** (já existe `divide-y` no container pai — duplica o separador)

#### `InactiveLeadsList.tsx`

- **Filtros de período**: adicionar `scrollbar-hide` ou `flex-nowrap` para evitar scrollbar horizontal visível
- Remover `divide-y` do container (separador já está no item via `border-b`)

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `InactiveLeadItem.tsx` | Corrigir visibilidade do timestamp, seleção, separador |
| `InactiveLeadsList.tsx` | Corrigir scroll horizontal nos filtros |

