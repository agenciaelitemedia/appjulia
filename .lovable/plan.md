

# Trocar `created_at` por `stage_entered_at` na query do card Atendimentos

## Alteração

### `src/pages/crm/hooks/useCRMData.ts` (linhas 19-26)

Na query da `useCRMJuliaSessions`, substituir todas as referências a `created_at` por `stage_entered_at`:

- Linha 22: `COUNT(DISTINCT (created_at AT TIME ZONE ...))` → `COUNT(DISTINCT (stage_entered_at AT TIME ZONE ...))`
- Linhas 25-26: filtro de data `created_at` → `stage_entered_at`

A view `vw_painelv2_desempenho_julia` precisa ter a coluna `stage_entered_at`. Caso não tenha, será necessário verificar as colunas disponíveis.

