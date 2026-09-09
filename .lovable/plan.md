# Taxa de implantação nos planos da Julia

Permitir cadastrar uma taxa de implantação por período em cada plano, mostrar essa taxa separada da mensalidade na página de venda e refletir o valor no contrato.

## Como vai funcionar

**Admin (Planos & Contrato → Planos)**
- No formulário de novo/editar plano, ao lado de cada preço (Mensal, Semestral, Anual) entra um campo "Taxa de implantação (R$)".
- Campo opcional: vazio ou zero significa "sem taxa".
- A tabela de planos passa a mostrar a taxa junto do valor de cada período (ex.: "R$ 2.500,00 + R$ 500,00 impl.").

**Página de venda (/comprar)**
- No cartão do plano, abaixo do valor: "+ R$ 500,00 de taxa de implantação (cobrança única)". Se não houver taxa, nada muda visualmente.
- No resumo do pedido antes do pagamento, três linhas explícitas:
  - Mensalidade (ou valor do período escolhido)
  - Taxa de implantação (cobrança única)
  - Total a pagar hoje = soma dos dois
- O valor enviado à cobrança passa a ser o total (plano + taxa), cobrado uma única vez com a taxa; as renovações seguem apenas o valor do plano.

**Contrato**
- Onde hoje aparece o valor do plano, passa a aparecer: `R$ 2.500,00 + taxa de R$ 500,00 de implantação`.
- Quando o plano não tiver taxa, o texto continua exatamente como hoje (só o valor).
- Novos marcadores disponíveis no editor de contrato: `{{setup_fee}}` e `{{total_first_payment}}`.

## Detalhes técnicos

1. Migração em `julia_plans`: adicionar `setup_fee_monthly`, `setup_fee_semiannual`, `setup_fee_annual` (integer, centavos, default 0). Em `julia_orders`: adicionar `setup_fee` (integer, default 0) e `total_amount` (integer, default 0) para registrar o cobrado.
2. `src/pages/admin/planos/PlanosPage.tsx`: estender `Plan`/`FormState`, três inputs de taxa, persistir no payload, exibir na tabela, e atualizar a lista de placeholders da aba Contrato.
3. `src/pages/comprar/ComprarPage.tsx`: `OrderData` recebe `setup_fee` e `total_amount`; o fluxo express também resolve a taxa do período escolhido.
4. `src/pages/comprar/steps/PlanStep.tsx`: `getSetupFeeByPeriod(plan)` e linha da taxa no cartão; `updateOrder` grava `setup_fee`.
5. `src/pages/comprar/steps/CheckoutStep.tsx`: resumo com Mensalidade / Taxa de implantação / Total; grava `setup_fee` e `total_amount` em `julia_orders` antes de invocar o checkout.
6. `src/pages/comprar/steps/ContractStep.tsx`: `plan_price` renderizado como `valor + taxa de X de implantação` quando `setup_fee > 0`; adicionar substituição de `{{setup_fee}}` e `{{total_first_payment}}`.
7. Edge functions `infinitypay-checkout`, `mercadopago-checkout`, `asaas-checkout`: cobrar `total_amount` quando presente e maior que zero, com fallback para `plan_price` (retrocompatível com pedidos antigos).
8. Verificar typecheck e build ao final.
