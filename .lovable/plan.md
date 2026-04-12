

## Plano: Valor Bruto vs Líquido nos Pedidos

### Contexto

A API do Mercado Pago retorna no objeto de pagamento os campos `fee_details` (array com as taxas cobradas) e `net_received_amount` (valor líquido). O webhook já salva o payload completo em `webhook_payload`, então esses dados já estão disponíveis. Precisamos:

1. Extrair e persistir esses valores em colunas dedicadas
2. Mostrar na UI: bruto, taxas, líquido

### Dados disponíveis na API do MP

```json
{
  "transaction_amount": 120.00,       // valor bruto
  "net_received_amount": 112.80,      // valor líquido
  "fee_details": [
    { "type": "mercadopago_fee", "amount": 7.20, "fee_payer": "collector" }
  ],
  "taxes_amount": 0
}
```

### Mudanças

#### 1. Migração — Adicionar colunas em `julia_orders`

- `net_amount` INTEGER (centavos) — valor líquido recebido
- `fee_amount` INTEGER (centavos) — total de taxas descontadas

#### 2. Webhook do MP — Extrair dados financeiros

No `mercadopago-webhook/index.ts`, ao processar pagamento aprovado, extrair:
- `net_received_amount` → converter para centavos → salvar em `net_amount`
- Somar `fee_details[].amount` → converter para centavos → salvar em `fee_amount`

#### 3. Hook `useOrders` — Incluir novos campos e stats

- Adicionar `net_amount` e `fee_amount` ao tipo `JuliaOrder`
- Adicionar aos stats: `totalNetRevenue` (soma dos líquidos) e `totalFees` (soma das taxas)
- Para pedidos que não têm `net_amount` (IP ou antigos), calcular a partir do `webhook_payload` se disponível

#### 4. `PedidosPage.tsx` — Cards de resumo financeiro

Substituir o card "Receita" por 3 cards:
- **Receita Bruta** (verde) — soma dos `paid_amount`
- **Taxas** (vermelho) — soma dos `fee_amount`
- **Receita Líquida** (roxo) — soma dos `net_amount`

Na tabela, adicionar coluna "Líquido" ao lado de "Valor".

#### 5. `OrderDetailSheet.tsx` — Seção financeira detalhada

Na seção "Pagamento", mostrar:
- Valor bruto, taxas, valor líquido
- Detalhamento das taxas do `fee_details` quando disponível no `webhook_payload`

### Arquivos

| Arquivo | Mudança |
|---------|---------|
| Migração SQL | Adicionar `net_amount`, `fee_amount` em `julia_orders` |
| `supabase/functions/mercadopago-webhook/index.ts` | Extrair `net_received_amount` e `fee_details` |
| `src/pages/admin/pedidos/hooks/useOrders.ts` | Novos campos + stats financeiros |
| `src/pages/admin/pedidos/PedidosPage.tsx` | Cards bruto/taxas/líquido + coluna líquido na tabela |
| `src/pages/admin/pedidos/components/OrderDetailSheet.tsx` | Detalhamento financeiro |

