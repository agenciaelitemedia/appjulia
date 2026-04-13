

## Plano: Corrigir Layout da Lista de Atendimento Humano

### Problemas

Com base no código atual e nos problemas relatados:

1. **Sidebar estreita demais** — `w-80` (320px) comprime nome + timestamp na mesma linha, fazendo o horário sumir
2. **Avatar grande demais** — `h-[42px] w-[42px]` ocupa espaço excessivo na sidebar de 320px
3. **Falta `max-w` no nome** — nome longo empurra o timestamp para fora da tela
4. **Badge de stage pode ficar invisível** — quando `stage_color` é `null`, o badge fica sem cor visível

### Mudanças

#### 1. `HumanSupportPage.tsx` — Aumentar largura da sidebar

- `w-80 min-w-[320px]` → `w-[360px] min-w-[360px]`

#### 2. `InactiveLeadItem.tsx` — Ajustar tamanhos e garantir visibilidade

- Avatar: `h-[42px] w-[42px]` → `h-9 w-9` (36px, compacto)
- Row 1 (nome + hora): forçar nome com `max-w-[65%]` e `truncate`; timestamp com `shrink-0 ml-auto`
- Row 2 (telefone + stage): manter como está, mas garantir fallback de cor no badge quando `stage_color` é null
- Padding: `py-3` → `py-2.5` para itens mais compactos
- Gap: `gap-3` → `gap-2.5`

#### 3. `InactiveLeadsList.tsx` — Sem mudanças necessárias

O código dos filtros já está correto com `scrollbar-hide`.

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `HumanSupportPage.tsx` | Aumentar largura sidebar para 360px |
| `InactiveLeadItem.tsx` | Reduzir avatar, limitar largura do nome, compactar padding |

