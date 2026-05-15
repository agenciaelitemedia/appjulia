Trocar `TeamOnlineTimeChart` para barras verticais (colunas):

- Remover `layout="vertical"` e usar layout padrão.
- `XAxis` recebe `dataKey="name"` (rotacionar `-25°` se necessário, fonte 11px) e `YAxis` numérico em horas.
- Bar com `radius={[4,4,0,0]}` e altura fixa do container `h-[260px]`.
- Mantém ordenação desc por horas, top 12, tooltip formatado em `Xh Ymin`.
- Sem mudanças em hooks ou na query.

Arquivo: `src/pages/equipe/components/TeamOnlineTimeChart.tsx`.