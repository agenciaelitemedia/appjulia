

# Fix: Confirmação de Pagamento InfinityPay

## Problema

1. **Webhook nunca foi chamado**: Zero requests recebidos no `infinitypay-webhook`. A InfinityPay pode não estar disparando o webhook, ou o endpoint público de checkout não registra webhooks corretamente.
2. **Bug de matching no webhook**: Mesmo se o webhook chegar, o código busca por `order_nsu` usando o NSU interno da InfinityPay (UUID), que não bate com nosso `JULIA-*`.

## Solução (2 frentes)

### 1. Corrigir webhook matching (`infinitypay-webhook/index.ts`)

Reescrever a lógica de busca do pedido:
- **Primário**: Buscar pelo `checkout_url` contendo o `invoice_slug` do payload
- **Fallback**: Buscar pedido `pending` mais recente com mesmo `plan_price` (amount)
- Armazenar o `order_nsu` da InfinityPay em `infinitypay_transaction_nsu`

### 2. Adicionar polling no checkout (`CheckoutStep.tsx`)

Como o webhook pode não chegar (ou demorar), o frontend faz polling a cada 5s no `julia_orders` verificando se `status` mudou de `pending` para `paid`. Quando detecta, redireciona para `/comprar/sucesso`.

Também adicionar um botão "Já paguei" que força uma verificação imediata.

### 3. Marcar pedido pago manualmente (migração)

Atualizar o pedido `4578cb2d-30eb-4b77-bc0e-c5b1fc1d52b8` para `paid` via migração, já que o pagamento foi feito mas nunca confirmado.

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/infinitypay-webhook/index.ts` | Nova lógica de matching por slug/amount |
| `src/pages/comprar/steps/CheckoutStep.tsx` | Polling de status + botão "Já paguei" |
| Migração SQL | UPDATE do pedido pendente para paid |

