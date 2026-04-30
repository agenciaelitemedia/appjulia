## Problema identificado

No fluxo `/telefonia/contratar`, o valor exibido no resumo do pedido (frontend) **diverge** do valor enviado para o pagamento (Mercado Pago).

### Causa raiz

A edge function `supabase/functions/telephony-order-create/index.ts` calcula a taxa de setup com uma constante hardcoded:

```ts
const SETUP_FEE_MONTHLY = 19700  // R$ 197,00
...
const setupFee = billing_period === 'monthly' ? SETUP_FEE_MONTHLY : 0
```

Ou seja:
- Sempre cobra **R$ 197,00 fixo** em planos mensais — independente do que está cadastrado no plano.
- Sempre cobra **R$ 0,00** em trimestral/semestral/anual — ignorando os valores do plano.

Já o frontend (`SelectPlanStep.tsx` + `types.ts → setupFeeForPeriod`) lê corretamente as 4 colunas reais da tabela `phone_extension_plans`:
- `setup_fee_monthly`
- `setup_fee_quarterly`
- `setup_fee_semiannual`
- `setup_fee_annual`

Por isso o resumo mostra um valor (do plano) e o checkout cobra outro (constante).

## Correção

Atualizar `supabase/functions/telephony-order-create/index.ts` para:

1. Remover a constante `SETUP_FEE_MONTHLY`.
2. Adicionar uma função `setupFeeFromPlan(plan, period)` espelhando exatamente a lógica do frontend:
   - Mapeia o período para a coluna correspondente (`setup_fee_monthly/quarterly/semiannual/annual`).
   - Retorna `0` quando o valor é `null/undefined` (sem cobrança).
   - Converte o valor de Reais (numeric) para centavos com `Math.round(value * 100)`.
3. Substituir o cálculo atual por:
   ```ts
   const setupFee = setupFeeFromPlan(plan, billing_period)
   ```

Os demais cálculos (preço do plano, addons de gravação/transcrição, ramais extras e total) já estão corretos e espelham o frontend — não precisam de alteração.

## Resultado esperado

- O `total_amount` salvo em `telephony_orders` e enviado ao Mercado Pago passará a refletir exatamente o que o usuário viu no resumo.
- Planos sem setup fee cadastrado não cobrarão setup.
- Planos com setup configurado em qualquer período (incluindo trimestral/semestral/anual) cobrarão o valor correto.

## Arquivos alterados

- `supabase/functions/telephony-order-create/index.ts` — única alteração necessária.
