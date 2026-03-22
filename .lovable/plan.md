

# Substituir card "Média Júlia" por card "FollowUp Ativos"

## O que muda
O card "Média Júlia" (posição 2 dos 6 cards) será substituído por um card que mostra a quantidade de leads com follow-up ativo. Um lead é considerado ativo quando `step_number > 0` (não finalizado). O subtexto mostrará quantos são infinitos vs em etapas normais.

## Fonte de dados
O `followupMap` já é carregado via `useFollowupActiveLeads` no `CRMPage.tsx`. Basta passá-lo como prop para `CRMDashboardSummary` e contar:
- **Ativos**: entries com `step_number > 0`
- **Infinitos**: entries ativas onde `is_infinite === true` e `step_number >= followup_to`
- **Em etapas**: ativos que não são infinitos

## Alterações

### 1. `src/pages/crm/CRMPage.tsx`
- Passar `followupMap` como prop para `CRMDashboardSummary`

### 2. `src/pages/crm/components/CRMDashboardSummary.tsx`
- Adicionar prop `followupMap?: Map<string, CRMFollowupInfo>`
- No `useMemo`, calcular contagens de follow-up ativos/infinitos/em etapas
- Substituir o card "Média Júlia" (linhas 171-190) por novo card:
  - Titulo: "FollowUp Ativos"
  - Valor grande: total de ativos
  - Subtexto: "X em etapas · Y infinitos"
  - Icone: `RefreshCw` ou `RotateCcw`
  - Borda: `border-l-chart-3` (mantém posição)
- Remover cálculos de `juliaAvgDays` / `phaseStats` que não serão mais usados

