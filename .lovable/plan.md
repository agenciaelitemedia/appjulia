

# Card de Tempo Médio por Fase da Julia

## O que será feito
Adicionar um novo card após "Atendimentos" no `CRMDashboardSummary` mostrando o tempo médio de permanência dos leads nas 4 fases atendidas pela Julia: **Entrada**, **Análise de Caso**, **Negociação** e **Contrato em Curso**.

## Cálculo
Para cada uma das 4 fases, filtrar os `cards` que estão naquela fase, calcular `(now - stage_entered_at)` de cada um e tirar a média. Os dados já existem no array `cards` e `stages` — não precisa de nova query.

## Layout do card
- Borda lateral colorida (chart-3, mantendo a cor do atual "Tempo Médio")
- Título: "Tempo por Fase"
- 4 linhas compactas, cada uma com: nome da fase (abreviado), barra de progresso proporcional e o tempo formatado (ex: `2d 5h`)
- A fase mais lenta fica destacada

## Alteração no grid
- Grid passa de `grid-cols-5` para `grid-cols-6` (no `lg:`)
- O card atual "Tempo Médio" (média geral) é **substituído** por este novo card mais detalhado, mantendo 5 cards no total
- Ordem: Atendimentos → **Tempo por Fase** → Taxa Contratos → Qualificados → Desqualificado

## Arquivo alterado
`src/pages/crm/components/CRMDashboardSummary.tsx`

