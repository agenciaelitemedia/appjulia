# Reorganizar barra superior do JulIA Chat

## Objetivo
Reduzir a barra superior do `/chat` a uma única linha compacta:
```text
[ Campo de busca ] [ ícone Filtros ] [ ícone Limpar ] [ ícone ⋮ ]
```
O ícone **⋮** abre um menu com as demais ações rápidas (ordenar, retornos, grupos, métricas, configurações).

## Mudanças no `src/modules/julia-chat/components/JuliaChatFilters.tsx`

### 1. Linha superior única
- Manter o campo de busca atual (com ícone `Search`, limpar interno e busca no `Enter`).
- Substituir o botão-texto **"Mais filtros"** por um ícone `SlidersHorizontal` (`size="icon"`) logo à direita do campo de busca.
  - Esse ícone continua acionando o `Collapsible` de filtros avançados.
  - Preservar o badge com a contagem de filtros ativos.
- Mover o botão **Limpar filtros** (`RotateCcw`) para logo após o ícone de filtros.
- Agrupar as demais ações rápidas em um `DropdownMenu` acionado por um ícone `MoreVertical` (⋮):
  - Ordenar conversas (`ArrowDownUp`) — abre o mesmo popover de sort ou um submenu.
  - Agenda de retornos (`CalendarClock`) — com badge de contagem.
  - Alternar grupos (`Users`) — quando `showGroupsTab` for true.
  - Métricas (`BarChart3`) — quando `canManageChat` for true.
  - Configurações do chat (`Settings`) — quando `canManageChat` for true.

### 2. Ajustes no painel "Mais filtros"
- Manter o `CollapsibleContent` absoluto com todos os filtros atuais (período, fila, atendente, modo, prioridade, etapas, marcadores, SLA, responsáveis, etiquetas).
- O painel continua abrindo ao clicar no ícone `SlidersHorizontal`.
- Preservar os chips-resumo quando o painel está recolhido.

### 3. Estados e comportamentos preservados
- `activeChips`, `dirty`, `onReset`, contagem de adiamentos (`snoozedCount`), navegação para métricas/configurações e toggle de grupos.
- Tooltips nos ícones visíveis; labels descritivos nos itens do menu ⋮.

## Critérios de aceitação
- A barra superior exibe apenas: campo de busca, ícone de filtros, ícone de limpar e ícone ⋮.
- O menu ⋮ contém ordenar, retornos, grupos (se permitido), métricas e configurações (se permitido).
- O painel "Mais filtros" continua funcionando com todos os filtros já migrados.
- Chips-resumo de filtros ativos continuam visíveis abaixo da linha quando recolhido.
- Build sem erros.
