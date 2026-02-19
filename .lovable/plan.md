

## Corrigir funis: usar nomes de etapas em vez de position >=

### Problema

A query usa `s.position >= (posição da Negociação)` para contar "Qualificados". Isso inclui TODAS as etapas com posição alta, não apenas Negociação/Contrato. Por isso aparece 17 em vez de 5.

### Solucao

Trocar `s.position >=` por filtro com nomes explícitos das etapas (`s.name IN (...)`), mantendo a logica cumulativa apenas entre as etapas conhecidas:

### Arquivo: `src/pages/dashboard/hooks/useDashboardFunnels.ts`

Alterar as CTEs de ambos os funis (Julia e Campanhas):

| Etapa do Funil | Filtro Atual (errado) | Filtro Correto |
|---|---|---|
| Em Qualificacao | `position >= (analise caso)` | `s.name IN ('Análise do Caso', 'Negociação', 'Contrato em Curso', 'Contrato Assinado')` ou equivalente com LIKE para analise |
| Qualificados | `position >= (Negociação)` | `s.name IN ('Negociação', 'Contrato em Curso', 'Contrato Assinado')` |
| Contratos Gerados | `position >= (Contrato em Curso)` | `s.name IN ('Contrato em Curso', 'Contrato Assinado')` |
| Contratos Assinados | `s.name = 'Contrato Assinado'` | Sem alteracao |

### Resultado esperado

- Qualificados = 4 (Negociação) + 1 (Contrato em Curso) = **5** (consistente com o CRM)
- Cada etapa conta apenas leads nos stages especificos, sem pegar etapas intermediarias indesejadas

