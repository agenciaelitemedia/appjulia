

# Separar "Tempo Julia" e adicionar "Tempo Humano"

## Contexto
O card atual "Tempo por Fase" mostra o tempo médio nas fases da Julia. O usuário quer renomeá-lo para deixar claro que é da Julia e adicionar um novo card ao lado com o tempo médio do atendimento humano.

## Definição de "Tempo Humano"
Calcular o tempo total de vida do card no CRM: da `created_at` até a resolução (`Contrato Assinado` ou `Desqualificado`). Para cards ainda ativos, usar o tempo até agora. Exibir:
- **Média geral** (número grande)
- **Resolvidos** vs **Em andamento** (subtexto)

## Alterações

### `src/pages/crm/components/CRMDashboardSummary.tsx`

1. **Renomear** card atual de "Tempo por Fase" para "Tempo Julia"
2. **Adicionar card** "Tempo Humano" após ele, com borda `border-l-chart-1` (ou outra cor distinta, ex: `blue-500`)
   - Ícone `User` + `Clock`
   - Número grande com `formatAvgTime` da média total
   - Subtexto: "X resolvidos · Y em andamento"
3. **Grid** passa de `grid-cols-5` para `grid-cols-6` no `lg:`
4. **Cálculo** no `useMemo`:
   - Cards resolvidos (Contrato Assinado ou Desqualificado): `(updated_at - created_at)` médio
   - Cards ativos (demais): `(now - created_at)` médio
   - Média ponderada de ambos

### Skeleton loading
Atualizar de 5 para 6 cards no loading state.

