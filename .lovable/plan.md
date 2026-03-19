

## Plano: Remover card "Total de Whatsapp" do Dashboard

### Mudança

**`src/pages/Dashboard.tsx`**
- Remover o primeiro item do array `statCards` (linhas 195-203, "Total de Whatsapp")
- Alterar grid de `lg:grid-cols-6` para `lg:grid-cols-5`
- Remover import `Users` (se não usado em outro lugar)
- Remover `sparklineData.leads` do `sparklineData` useMemo (cleanup)
- Ajustar skeleton loading de 4 colunas se necessário

Resultado: 5 cards — Atendimentos, MQL, SQL, Contratos Gerados/Assinados, Atendimentos x Contratos.

