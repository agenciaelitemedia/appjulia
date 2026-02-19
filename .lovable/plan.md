

## Remover cards e adicionar MQL / SQL no Dashboard

### Resumo

- **Remover**: "Mensagens Enviadas" e "Agentes Selecionados"
- **Adicionar**: MQL e SQL logo apos "Atendimentos"
- **MQL** = leads em "Negociacao" (Qualificados no funil)
- **SQL** = leads em "Contrato em Curso" + "Contrato Assinado"

**Ordem final (6 cards):**

| # | Card | Valor |
|---|------|-------|
| 1 | Total de Whatsapp | totalLeads |
| 2 | Atendimentos | totalSessions |
| 3 | MQL | mqlCount + taxa % sobre atendimentos |
| 4 | SQL | sqlCount + taxa % sobre atendimentos |
| 5 | Contratos Gerados/Assinados | conversions |
| 6 | Atendimentos x Contratos | rate % |

### Detalhes tecnicos

#### 1. `src/pages/dashboard/hooks/useDashboardData.ts`

**`useDashboardStats`** - adicionar 1 query para MQL (a query de SQL ja existe como `conversionsResult`):

```sql
-- MQL: leads qualificados (Negociacao + Contrato em Curso + Contrato Assinado)
SELECT COUNT(*) as count
FROM crm_atendimento_cards c
JOIN crm_atendimento_stages s ON c.stage_id = s.id
WHERE s.name IN ('Negociação', 'Contrato em Curso', 'Contrato Assinado')
  AND c.cod_agent = ANY($1::varchar[])
  AND (c.stage_entered_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
  AND (c.stage_entered_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
```

O SQL ja e contado pela query `conversionsResult` existente (Contrato em Curso + Contrato Assinado).

Retorno passa a incluir `mqlCount`.

**`useDashboardStatsPrevious`** - mesma query MQL adicional com datas do periodo anterior. Retorno inclui `mqlCount`.

#### 2. `src/pages/Dashboard.tsx`

- Remover imports `MessageSquare` e `Bot`
- Adicionar imports `Filter` (MQL) e `Handshake` (SQL) do lucide-react
- Adicionar `mql` em `changes` usando `calculateChange(stats.mqlCount, statsPrevious.mqlCount)`
- Calcular `mqlRate` e `sqlRate` (% sobre totalSessions) com `useMemo`
- Calcular `mqlRateChange` e `sqlRateChange` comparando com periodo anterior
- Atualizar array `statCards`: remover "Mensagens Enviadas" e "Agentes Selecionados", inserir MQL e SQL na posicao 3 e 4
- Cards MQL e SQL mostram numero absoluto como valor principal e "X de Y atendimentos (XX.X%)" como descricao

