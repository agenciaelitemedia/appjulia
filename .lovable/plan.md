

## Renomeações e novo card no CRM Atende Julia

### Resumo das alterações

Todas as mudanças são no arquivo `src/pages/crm/components/CRMDashboardSummary.tsx`. O grid passará de 5 para 6 cards.

### 1. Renomeações de texto

| Card atual | Novo nome | Descrição (subtitle) |
|---|---|---|
| "Leads" | **"Whatsapp"** | mantém "total no período" |
| "Atendimentos" + "sessões Julia" | **"Atendimentos"** + "atendimentos da Julia" | substitui "sessões Julia" no subtitle |
| "Taxa de Conversão" + "de X sessões" | **"Taxa Contratos"** + "de X atendimentos" | substitui "sessões" no subtitle |
| "Ativos x Perdidos" | **"Taxa Desqualificados"** | muda cálculo (ver item 3) |

### 2. Novo card: "Qualificados"

Inserido como 5o card (antes de "Taxa Desqualificados"):

- **Titulo**: Qualificados
- **Valor**: percentual = (qualificados / totalSessions) * 100, exibido como `X.X%`
- **Qualificados** = cards nos estágios "Negociação" + "Contrato em Curso" + "Contrato Assinado"
- **Subtitle**: `N de M atendimentos` (N = count qualificados, M = totalSessions)
- **Icone**: `Star` ou `CheckCircle` com cor `chart-2` (verde)

### 3. Alteração do cálculo "Taxa Desqualificados"

Atualmente mostra `activeRate` (% ativos sobre total de cards). Novo cálculo:

- **Valor**: `(desqualificados / totalSessions) * 100`, exibido como `X.X%`
- **Subtitle**: `N de M atendimentos` (N = count desqualificados, M = totalSessions)
- Mantém o mini PieChart existente (Qualificados vs Desqualificados)

### 4. Ajuste de grid

O grid muda de `grid-cols-2 lg:grid-cols-5` para `grid-cols-2 lg:grid-cols-6`, e o skeleton loader também passa para 6 cards.

### Ordem final dos cards

1. **Whatsapp** - total de leads no período (sparkline)
2. **Atendimentos** - média diária + total atendimentos da Julia
3. **Tempo Médio** - sem alteração
4. **Taxa Contratos** - contratos / atendimentos
5. **Qualificados** - (negociação + contratos) / atendimentos [NOVO]
6. **Taxa Desqualificados** - desqualificados / atendimentos

### Detalhes técnicos

No `useMemo` do `stats`, serão adicionadas:
- Busca do stage "Negociação" via `stages.find(s => s.name === 'Negociação')`
- Contagem de `qualified` = cards em Negociação + Contrato em Curso + Contrato Assinado
- `qualifiedRate = totalSessions > 0 ? (qualified / totalSessions) * 100 : 0`
- `disqualifiedRate = totalSessions > 0 ? (disqualified / totalSessions) * 100 : 0`
- Atualização do `pieData` para refletir Qualificados vs Desqualificados
