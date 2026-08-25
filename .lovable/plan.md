# Reorganizar filtros do JulIA Chat

## Objetivo
Compactar a barra de filtros do `/chat` movendo o seletor de etapas do CRM da Júlia para dentro do painel "Mais filtros" e deixando os ícones de modo (Júlia/humano/todos) na mesma linha dos filtros de fila e atendente.

## Mudanças no `src/modules/julia-chat/components/JuliaChatFilters.tsx`

1. **Remover a Linha 4 atual** (`modo + etapas`):
   - Tirar o `Popover` de etapas (`Todas as etapas`) de fora do collapsible.
   - Manter apenas o grupo de ícones de modo (todos / Júlia IA / humano).

2. **Inserir o seletor de etapas dentro do painel "Mais filtros"**:
   - Adicionar uma nova seção no `CollapsibleContent`, acima ou junto aos chips de "Etiquetas", com o mesmo popover/checkbox de etapas que existe hoje.
   - Preservar a lógica de `allStagesSelected`, `toggleAllStages` e `toggleIn('julia_stage_ids', ...)`.

3. **Unir fila, atendente e ícones de modo em uma única linha**:
   - Substituir o `grid grid-cols-2` da Linha 3 por um layout flex/grid de 3 colunas.
   - Fila (`Popover` com `Layers`) → primeira coluna.
   - Atendente (`TeamMemberSelect`) → segunda coluna.
   - Ícones de modo (todos/Júlia/humano) → terceira coluna, sem texto, apenas ícones com tooltips.
   - Em telas estreitas, os ícones devem encolher para `shrink-0` e os outros campos devem truncar o texto.

4. **Ajustes visuais**:
   - Remover o fundo destacado (`bg-primary/5 border-primary/30`) dos ícones de modo para não competir com os outros filtros; usar aparência similar aos botões de outline/ghost.
   - Garantir altura uniforme (`h-8`) entre fila, atendente e ícones.

## Critérios de aceitação
- O seletor "Todas as etapas" não aparece mais na linha principal de filtros.
- O seletor de etapas é acessível dentro de "Mais filtros".
- Fila, atendente e ícones de modo ficam na mesma linha.
- Tooltips e estados ativos/inativos dos ícones continuam funcionando.
- Build sem erros.
