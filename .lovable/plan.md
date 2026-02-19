

## Substituir `vw_desempenho_julia` por `vw_painelv2_desempenho_julia`

Alteracao direta em 6 arquivos, trocando todas as ocorrencias da view antiga pela nova. Inclui tanto `vw_desempenho_julia` quanto `vw_desempenho_julia_contratos`.

### Arquivos e alteracoes

| Arquivo | Ocorrencias | Troca |
|---------|-------------|-------|
| `src/pages/dashboard/hooks/useDashboardFunnels.ts` | 1x `vw_desempenho_julia` | `vw_painelv2_desempenho_julia` |
| `src/pages/dashboard/hooks/useDashboardData.ts` | 4x `vw_desempenho_julia` | `vw_painelv2_desempenho_julia` |
| `src/pages/crm/hooks/useContractInfo.ts` | 1x `vw_desempenho_julia_contratos` | `vw_painelv2_desempenho_julia_contratos` |
| `src/pages/estrategico/hooks/useJuliaData.ts` | 2x `vw_desempenho_julia` + 2x `vw_desempenho_julia_contratos` | `vw_painelv2_desempenho_julia` e `vw_painelv2_desempenho_julia_contratos` |
| `src/pages/crm/hooks/useCRMData.ts` | 1x `vw_desempenho_julia` | `vw_painelv2_desempenho_julia` |
| `src/pages/crm/hooks/useCRMStatistics.ts` | 1x `vw_desempenho_julia` | `vw_painelv2_desempenho_julia` |

### Regra de substituicao

- `vw_desempenho_julia` -> `vw_painelv2_desempenho_julia`
- `vw_desempenho_julia_contratos` -> `vw_painelv2_desempenho_julia_contratos`

Nenhuma outra alteracao de logica. Apenas renomear a view nas queries SQL.

