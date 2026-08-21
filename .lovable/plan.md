Remover o mapa de calor da página de métricas de chat

## Objetivo
Remover o componente de mapa de calor ("Mapa de Calor — Volume por Dia × Hora") da página `/chat/metricas`.

## Escopo
- Alteração única no frontend.
- Página afetada: `src/pages/chat/ChatMetricsPage.tsx`.
- Componente a remover: `ChatHeatmap` (importado na linha 23 e renderizado na linha 724).

## Passos
1. Remover o import de `ChatHeatmap` no topo de `src/pages/chat/ChatMetricsPage.tsx`.
2. Remover o bloco de renderização `{/* ── Heatmap ───────────────────────────────────────────────────── */}` e `<ChatHeatmap conversations={filtered} />` no corpo da página.
3. Validar o build após a alteração.

## Não incluso
- Não excluir o arquivo `src/components/chat/analytics/ChatHeatmap.tsx` (mantido disponível para reutilização futura).
- Não alterar dados, filtros ou outros componentes da página.
