

## Ajustes visuais nos cards do CRM

Arquivo: `src/pages/crm/components/CRMDashboardSummary.tsx`

### 1. Diferenciar cores dos cards "Taxa Contratos" e "Qualificados"

Atualmente ambos usam `chart-2` (verde). Mudanças:
- **Taxa Contratos** (card 4): manter `chart-2` (verde)
- **Qualificados** (card 5): mudar para `chart-4` (azul/roxo) para diferenciar visualmente -- borda, fundo do ícone e cor do ícone

### 2. Renomear "Taxa Desqualificados" para "Desqualificado"

- Trocar o texto de `"Taxa Desqualificados"` para `"Desqualificado"`

### 3. Substituir mini gráfico por ícone no card "Desqualificado"

- Remover o `PieChart` / `ResponsiveContainer` do card 6
- Substituir por um ícone `XCircle` com fundo `chart-5/10` e cor `chart-5`, no mesmo padrão dos demais cards
- Remover imports não utilizados (`PieChart`, `Pie`, `Cell`) e a variável `pieData` do `useMemo`

### Resultado visual final

| Card | Cor da borda | Ícone |
|---|---|---|
| Whatsapp | chart-1 | sparkline |
| Atendimentos | chart-4 | Headphones |
| Tempo Médio | chart-3 | Clock |
| Taxa Contratos | chart-2 | Target |
| Qualificados | chart-4 | CheckCircle |
| Desqualificado | chart-5 | XCircle |
