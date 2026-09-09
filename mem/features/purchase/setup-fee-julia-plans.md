---
name: Taxa de implantação nos planos Julia
description: Taxa de implantação por período em julia_plans, exibição separada no checkout /comprar e no contrato
type: feature
---

- `julia_plans` tem `setup_fee_monthly`, `setup_fee_semiannual`, `setup_fee_annual` (centavos, default 0). Vazio/0 = sem taxa.
- `julia_orders` grava `setup_fee` e `total_amount` (centavos) no primeiro pagamento.
- Cobrança única: total do primeiro pagamento = valor do período + taxa. Renovações usam só o valor do plano.
- `/comprar`: cartão do plano mostra "+ R$ X de taxa de implantação"; resumo separa Mensalidade / Taxa de implantação / Total a pagar hoje.
- Checkout: InfinityPay e Mercado Pago enviam a taxa como item separado; Asaas usa `total_amount` (fallback `plan_price + setup_fee`).
- Contrato: `{{plan_price}}` renderiza `R$ X + taxa de R$ Y de implantação` quando houver taxa. Placeholders extras: `{{setup_fee}}`, `{{total_first_payment}}`.
