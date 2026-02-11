

## Correcao do Mapeamento dos Funis

### Problema encontrado

No funil de campanhas do Dashboard, o bloco UNION ALL nas linhas 186-190 tem as posicoes 1 e 2 mapeadas para os CTEs errados:

| Posicao | Label | CTE atual (errado) | CTE correto |
|---------|-------|---------------------|-------------|
| 0 | Atendimentos | entrada | entrada (ok) |
| 1 | Em Qualificacao | **atendidos** (log_first_messages) | **em_qualificacao** (Analise de Caso) |
| 2 | Qualificados | **em_qualificacao** (Analise de Caso) | **qualificados** (Negociacao) |
| 3 | Contratos Gerados | contratos_gerados | contratos_gerados (ok) |
| 4 | Contratos Assinados | contratos_assinados | contratos_assinados (ok) |

O CTE `atendidos` (que conta leads com `log_first_messages`) nao tem equivalente no funil Julia, entao ele esta "sobrando" e empurrando as posicoes seguintes para o CTE errado.

### Valores esperados (confirmados pelo usuario)

Campanha: Atendimentos 53, Em Qualificacao 37, Qualificado 12, Contratos Gerados 5.

### Correcao

**Arquivo:** `src/pages/dashboard/hooks/useDashboardFunnels.ts`

1. Remover o CTE `atendidos` (linhas 136-143) da query de campanhas, pois nao e usado em nenhuma posicao do funil e nao tem equivalente no funil Julia

2. Corrigir o UNION ALL (linhas 186-190) para:

```sql
SELECT 'Atendimentos', '#22c55e', 0, (SELECT count FROM entrada)
UNION ALL SELECT 'Em Qualificação', '#eab308', 1, (SELECT count FROM em_qualificacao)
UNION ALL SELECT 'Qualificados', '#f97316', 2, (SELECT count FROM qualificados)
UNION ALL SELECT 'Contratos Gerados', '#3b82f6', 3, (SELECT count FROM contratos_gerados)
UNION ALL SELECT 'Contratos Assinados', '#8b5cf6', 4, (SELECT count FROM contratos_assinados)
```

Isso alinha o funil de campanhas com o funil Julia, garantindo que ambos usem as mesmas definicoes de estagio (Analise de Caso, Negociacao, Contrato em Curso, Contrato Assinado) e que o funil organico (Julia - Campanhas) seja calculado corretamente.

O funil Julia nao precisa de alteracao - seu mapeamento ja esta correto.

