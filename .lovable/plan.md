

# Filtrar e calcular tempos por `stage_entered_at`

## Situação atual
- A query de cards já filtra por `stage_entered_at` — correto.
- O cálculo de **Média Tempo Julia** já usa `stage_entered_at` — correto.
- O cálculo de **Tempo Humano** usa `created_at` e `updated_at` — inconsistente.

## Alteração

### `src/pages/crm/components/CRMDashboardSummary.tsx`

Ajustar o cálculo do **Tempo Humano** (linhas 84-97) para usar `stage_entered_at` em vez de `created_at`:

- **Cards resolvidos**: tempo = `updated_at - stage_entered_at` (tempo na fase final)
- **Cards ativos**: tempo = `now - stage_entered_at` (tempo na fase atual)

Isso torna o cálculo consistente com o filtro e com o card da Julia, ambos baseados em `stage_entered_at`.

