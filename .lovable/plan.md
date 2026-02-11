

## Alterações na tabela Performance por Agente

Arquivos afetados: `src/pages/crm/types.ts`, `src/pages/crm/hooks/useCRMStatistics.ts`, `src/pages/crm/statistics/components/AgentPerformanceTable.tsx`

### 1. Atualizar tipo `CRMAgentPerformance`

Adicionar campos e renomear:
- `converted_leads` -> `qualified_leads` (Negociacao + Contrato em Curso + Contrato Assinado)
- `conversion_rate` -> `qualified_rate` (qualified_leads / total * 100)
- Novo: `contract_leads` (Contrato em Curso + Contrato Assinado)
- Novo: `contract_rate` (contract_leads / total * 100)
- `avg_time_days` permanece (armazenado em dias, formatado no front)

### 2. Atualizar query SQL em `useCRMAgentPerformance`

A query atual calcula "conversion_stages" como Contrato em Curso + Contrato Assinado. Nova query:

- **qualified_stages**: Negociacao + Contrato em Curso + Contrato Assinado
- **contract_stages**: Contrato em Curso + Contrato Assinado
- Retornar: `qualified_leads`, `qualified_rate`, `contract_leads`, `contract_rate`

### 3. Atualizar tabela `AgentPerformanceTable`

| Coluna atual | Nova coluna |
|---|---|
| **Leads** | **Atendimentos** (mesmo valor total_leads) |
| **Conversao** (conversion_rate) | **Qualificados** (qualified_rate com badge) |
| _(nova)_ | **Contratos** (contract_rate com badge) |
| **Tempo Medio** (X.Xd) | **Tempo Medio** (formatado: horas se < 24h, dias+horas se >= 24h) |

Formatacao do tempo medio:
- < 1 hora: `Xmin`
- 1h a 23h59: `Xh Ymin`
- 24h+: `Xd Yh`

SortKey atualizado para incluir `qualified_rate` e `contract_rate`.

Subtexto da coluna Atendimentos: `(N qualificados)` em vez de `(N convertidos)`.
