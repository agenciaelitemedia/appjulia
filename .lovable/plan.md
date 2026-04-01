

# Formulário de Compra Julia + Checkout InfinityPay

## Resumo

Página pública `/comprar` com fluxo: **CPF/CNPJ → Dados do cliente → Seleção de plano → Checkout InfinityPay**. Design inspirado no atendejulia.com.br (roxo #6C3AED). Módulo admin "Pedidos da Julia" em `/admin/pedidos`.

## API InfinityPay — Formato Confirmado

O checkout usa a API pública sem autenticação, apenas com o `handle`:

```json
POST https://api.infinitepay.io/invoices/public/checkout/links
{
  "handle": "masterchat-inova",
  "items": [
    { "quantity": 1, "price": 1000, "description": "Plano Essencial" }
  ],
  "webhook_url": "https://zenizgyrwlonmufxnjqt.supabase.co/functions/v1/infinitypay-webhook",
  "customer": {
    "name": "Mario castro",
    "email": "mario.r.castro@gmail.com",
    "phone_number": "+5534988860163"
  }
}
```

- `handle`: identificador da conta InfinityPay (`masterchat-inova`)
- `price`: valor em **centavos** (1000 = R$10,00)
- `webhook_url`: já definida, aponta para a edge function
- Sem necessidade de API key — apenas o handle

## Fluxo do Usuário

```text
Step 1: CPF/CNPJ         Step 2: Dados           Step 3: Plano           Step 4: Checkout
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ Input CPF/CNPJ   │──▶│ Nome completo    │──▶│ Cards visuais    │──▶│ Resumo pedido    │
│ (auto-detect)    │    │ E-mail           │    │ dos planos       │    │ Botão "Pagar"    │
│ Se já existe:    │    │ WhatsApp         │    │ com features     │    │ → redireciona    │
│ preenche dados   │    │ Endereço         │    │ Badge "Popular"  │    │   InfinityPay    │
└──────────────────┘    │ → Salva draft DB │    └──────────────────┘    └──────────────────┘
```

## Implementação

### 1. Migração — Tabela `julia_orders`

```sql
CREATE TABLE public.julia_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  customer_document text NOT NULL,
  customer_address text NOT NULL,
  customer_email text NOT NULL,
  customer_whatsapp text NOT NULL,
  plan_name text NOT NULL DEFAULT '',
  plan_price integer NOT NULL DEFAULT 0,
  billing_period text DEFAULT 'monthly',
  status text NOT NULL DEFAULT 'draft',
  order_nsu text UNIQUE,
  checkout_url text,
  infinitypay_transaction_nsu text,
  receipt_url text,
  paid_amount integer,
  installments integer,
  webhook_payload jsonb,
  cod_agent text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
ALTER TABLE public.julia_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access julia_orders" ON public.julia_orders FOR ALL USING (true) WITH CHECK (true);
```

### 2. Edge Function `infinitypay-checkout`

Recebe `order_id` do frontend. Busca o pedido no DB, monta o payload exato:

```typescript
const body = {
  handle: "masterchat-inova",
  items: [{ quantity: 1, price: order.plan_price, description: order.plan_name }],
  webhook_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/infinitypay-webhook`,
  customer: {
    name: order.customer_name,
    email: order.customer_email,
    phone_number: `+55${order.customer_whatsapp.replace(/\D/g, '')}`
  }
};
const resp = await fetch('https://api.infinitepay.io/invoices/public/checkout/links', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});
```

Atualiza pedido com `checkout_url` e status `pending`. Retorna URL ao frontend.

### 3. Edge Function `infinitypay-webhook`

Recebe POST da InfinityPay. Localiza pedido pelo `order_nsu`. Atualiza status para `paid`, salva `paid_amount`, `receipt_url`, payload completo.

### 4. Páginas Públicas (fora do MainLayout)

| Arquivo | Descrição |
|---|---|
| `src/pages/comprar/ComprarPage.tsx` | Stepper 4 etapas, design roxo/gradiente |
| `src/pages/comprar/steps/DocumentStep.tsx` | CPF/CNPJ com máscara, busca existente |
| `src/pages/comprar/steps/CustomerStep.tsx` | Nome, email, WhatsApp, endereço → salva draft |
| `src/pages/comprar/steps/PlanStep.tsx` | Cards visuais dos planos |
| `src/pages/comprar/steps/CheckoutStep.tsx` | Resumo + botão pagar |
| `src/pages/comprar/ComprarSucessoPage.tsx` | Confirmação pós-pagamento |

### 5. Módulo Admin `/admin/pedidos`

| Arquivo | Descrição |
|---|---|
| `src/pages/admin/pedidos/PedidosPage.tsx` | Dashboard + listagem filtrada |
| `src/pages/admin/pedidos/hooks/useOrders.ts` | Hook CRUD `julia_orders` |

### 6. Rotas (App.tsx)

```tsx
<Route path="/comprar" element={<ComprarPage />} />
<Route path="/comprar/sucesso" element={<ComprarSucessoPage />} />
<Route path="/admin/pedidos" element={<ProtectedRoute module="julia_orders"><PedidosPage /></ProtectedRoute>} />
```

### 7. Tipos

Adicionar `julia_orders` ao `ModuleCode` em `src/types/permissions.ts`.

## Handle

O handle `masterchat-inova` será hardcoded na edge function (já fornecido). Sem necessidade de secret adicional — a API é pública.

