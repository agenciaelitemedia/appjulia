

# Unificar contagem Desempenho Julia com CRM Atendimentos

## Problema

| Local | View | Filtro de data | Contagem |
|---|---|---|---|
| CRM — card "Atendimentos" | `vw_painelv2_desempenho_julia` | `stage_entered_at` | COUNT(DISTINCT session_id) via SQL |
| Desempenho Julia — "Total Atendimentos" | `vw_painelv2_desempenho_julia` | `created_at` | Distinct session_id via JS (Set) |

Mesma view, mas filtros de data em colunas diferentes (`stage_entered_at` vs `created_at`) geram contagens diferentes.

## Solução

Alterar a query do hook `useJuliaSessoes` (usado pela página Desempenho) para filtrar por `stage_entered_at` em vez de `created_at`, alinhando com o CRM.

Fazer o mesmo no hook `useJuliaSessoesPrevious` para manter a comparação consistente.

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| `src/pages/estrategico/hooks/useJuliaData.ts` | No `useJuliaSessoes`: trocar `created_at` por `stage_entered_at` nas cláusulas WHERE de data. No `useJuliaSessoesPrevious`: mesma troca. |

