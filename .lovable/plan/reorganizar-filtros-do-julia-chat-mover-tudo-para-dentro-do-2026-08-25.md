# Reorganizar filtros do JulIA Chat — mover tudo para dentro do bloco "Mais filtros"

## Objetivo
Deixar a barra superior do JulIA Chat apenas com a busca e ações rápidas. Todos os demais controles (período, fila, atendente e modo Júlia/humano) devem migrar para dentro do painel colapsado "Mais filtros", ao lado dos filtros já existentes (prioridade, etapas, marcadores, SLA, responsáveis e etiquetas).

## Mudanças no `src/modules/julia-chat/components/JuliaChatFilters.tsx`

### 1. Remover a linha de período da barra principal
- Excluir o bloco que renderiza `CalendarDays` + pills `PERIOD_OPTIONS` (atualmente Linha 2, imediatamente abaixo da busca).
- Reaproveitar `PERIOD_OPTIONS` dentro do painel "Mais filtros" como um novo grupo de chips.

### 2. Remover a linha de fila + atendente + modo da barra principal
- Excluir o bloco flex que contém:
  - Popover de seleção de filas (`queueLabel`, `Layers`, `ChevronsUpDown`).
  - `TeamMemberSelect` de atendente/responsável.
  - Grupo de ícones de modo (todos / Júlia IA / humano).
- Reaproveitar os mesmos componentes dentro do painel "Mais filtros".

### 3. Inserir os filtros migrados no painel "Mais filtros"
Dentro do `CollapsibleContent`, logo após a linha de `Prioridade` + `Etapas do CRM da Júlia` (ou em seção própria), adicionar:

- **Período**: novo `Group` "Período" com chips para cada item de `PERIOD_OPTIONS`.
- **Fila**: mover o Popover/Command de filas, mantendo a lógica `queueOpen`, `queueLabel` e seleção única/multipla conforme hoje.
- **Atendente**: mover o `TeamMemberSelect` com as opções extras (`Todos Atendimentos`, `Meus atendimentos`, `Aguardando Atendimento`) e a lógica `ownerValue`/`setOwnerValue`.
- **Modo Júlia**: mover o grupo de ícones `modeButtons` (todos / Júlia / humano), mantendo tooltips e estados ativos/inativos.

### 4. Ajustar o layout interno do painel
- Organizar os filtros em grupos visuais claros dentro do `CollapsibleContent`:
  - Prioridade / Etapas (grid de 2 colunas, já existente).
  - Período (chips).
  - Fila / Atendente / Modo (grid de 2-3 colunas ou linha empilhada, conforme couber).
  - Marcadores, SLA, Responsáveis, Etiquetas (já existentes).
- Garantir que o painel não fique muito alto; manter `max-h-[75vh]` com scroll.

### 5. Atualizar o cálculo de `dirty` e `activeChips`
- `dirty` já considera `period`, `queue_ids`, `owners` e `julia_mode`; manter.
- `activeChips` já gera chips para `priority`, `unassigned`, `has_ticket`, `has_crm_builder`, `has_campaign`, `sla_status`, `tag_ids`; adicionar chips para:
  - `period` diferente de `all`.
  - `queue_ids` selecionadas.
  - `owners` / `unassigned` / `mine`.
  - `julia_mode` diferente de `all`.
- Isso garante que, ao fechar o painel, o usuário veja um resumo dos filtros ativos.

### 6. Ajustes visuais
- Manter altura `h-8` para os selects migrados.
- Usar labels `text-[10px] uppercase tracking-wide text-muted-foreground` para os novos grupos, seguindo o padrão dos existentes.
- Garantir que o `CollapsibleContent` continue com `z-50` e posicionamento `absolute left-0 right-0 top-full` para não quebrar o layout da lista.

## Critérios de aceitação
- A barra principal contém apenas: busca, ordenar, agenda de retornos, toggle de grupos (quando habilitado), métricas, configurações e limpar filtros.
- Período, fila, atendente e modo Júlia/humano só aparecem após expandir "Mais filtros".
- Todos os estados e comportamentos dos filtros migrados permanecem funcionais.
- Os filtros ativos continuam sendo exibidos como chips-resumo quando o painel está recolhido.
- Build sem erros.
