

## Plano: Integração Mercado Pago + Configurações de Pagamento no Admin

### Visão Geral

Adicionar Mercado Pago como opção de pagamento na página `/comprar` via Checkout Pro (preferências com redirect — a abordagem mais robusta e sem necessidade de SDK frontend). O método de pagamento é selecionado pelo parâmetro `p=mp` ou `p=ip` na URL. No admin, adicionar botão de configurações nos Pedidos com tela para gerenciar credenciais de ambos os gateways.

### Estratégia Mercado Pago

Usar a **API de Preferências** (`POST https://api.mercadopago.com/checkout/preferences`) que retorna um `init_point` (produção) ou `sandbox_init_point` (testes). É a forma mais confiável — não requer SDK no frontend, funciona como o InfinityPay atual (abre link em nova aba). O webhook do MP confirma o pagamento via IPN.

---

### 1. Migração de Banco de Dados

Adicionar à tabela `julia_orders`:
- `payment_gateway` TEXT DEFAULT 'infinitypay' — identifica qual gateway processou (`infinitypay` ou `mercadopago`)
- `mp_preference_id` TEXT — ID da preferência do Mercado Pago
- `mp_payment_id` TEXT — ID do pagamento confirmado

Criar tabela `julia_payment_config`:
- `id` UUID PK
- `gateway` TEXT NOT NULL (`infinitypay` | `mercadopago`)
- `is_active` BOOLEAN DEFAULT true
- `is_sandbox` BOOLEAN DEFAULT false
- `config` JSONB DEFAULT '{}' — armazena access_token, public_key, etc.
- `created_at`, `updated_at` TIMESTAMPTZ

### 2. Edge Function `mercadopago-checkout`

Nova edge function que:
1. Recebe `{ order_id }` 
2. Busca o pedido e as credenciais da tabela `julia_payment_config`
3. Cria preferência via `POST https://api.mercadopago.com/checkout/preferences` com:
   - `items`, `payer`, `back_urls`, `notification_url`, `external_reference: order_id`
   - Usa `sandbox_init_point` ou `init_point` conforme `is_sandbox`
4. Atualiza o pedido com `mp_preference_id`, `checkout_url`, `status: pending`, `payment_gateway: mercadopago`
5. Retorna `checkout_url`

### 3. Edge Function `mercadopago-webhook`

Nova edge function que:
1. Recebe notificação IPN do Mercado Pago (`topic=payment`, `id=...`)
2. Consulta `GET https://api.mercadopago.com/v1/payments/{id}` com access_token
3. Se `status === 'approved'`, atualiza o pedido: `status: paid`, `paid_amount`, `paid_at`, `mp_payment_id`, `webhook_payload`

### 4. Frontend — ComprarPage e CheckoutStep

**`ComprarPage.tsx`**:
- Ler parâmetro `p` da URL (`mp` ou `ip`, default `ip`)
- Adicionar `payment_gateway` ao `OrderData`
- Passar ao `CheckoutStep`

**`CheckoutStep.tsx`**:
- Se `payment_gateway === 'mercadopago'`: chamar `mercadopago-checkout` em vez de `infinitypay-checkout`
- Ajustar textos ("Pagamento seguro via Mercado Pago" vs "via InfinityPay")
- Mesma lógica de polling para confirmar pagamento

### 5. Admin — Configurações de Pagamento

**Novo componente `PaymentSettingsDialog.tsx`**:
- Botão "Configurações" (ícone engrenagem) no header da `PedidosPage`
- Dialog com Tabs: "Geral" | "Métodos de Pagamento"
- Tab "Métodos de Pagamento":
  - Seção InfinityPay: handle (já fixo), toggle ativo
  - Seção Mercado Pago: campos access_token, public_key, toggle sandbox, toggle ativo
  - Salva na tabela `julia_payment_config`

**`PedidosPage.tsx`**:
- Adicionar coluna "Gateway" na tabela com badge (MP azul, IP verde)
- Botão de configurações no header

**`OrderDetailSheet.tsx`**:
- Mostrar gateway de pagamento e IDs específicos (MP preference_id, payment_id)

### Arquivos

| Arquivo | Mudança |
|---------|---------|
| Migração SQL | Adicionar colunas `payment_gateway`, `mp_*` em `julia_orders` + criar `julia_payment_config` |
| `supabase/functions/mercadopago-checkout/index.ts` | Nova edge function — criar preferência MP |
| `supabase/functions/mercadopago-webhook/index.ts` | Nova edge function — processar IPN |
| `src/pages/comprar/ComprarPage.tsx` | Ler param `p`, passar `payment_gateway` ao fluxo |
| `src/pages/comprar/steps/CheckoutStep.tsx` | Condicional MP vs IP para gerar checkout |
| `src/pages/admin/pedidos/PedidosPage.tsx` | Coluna gateway + botão configurações |
| `src/pages/admin/pedidos/components/OrderDetailSheet.tsx` | Mostrar dados MP |
| `src/pages/admin/pedidos/components/PaymentSettingsDialog.tsx` | Novo — configurações de gateways |
| `src/pages/admin/pedidos/hooks/useOrders.ts` | Incluir `payment_gateway` no tipo |

### Segurança

- Access tokens do MP ficam na tabela `julia_payment_config` (não em secrets hardcoded), permitindo que o admin altere via UI
- O webhook do MP valida o pagamento consultando a API do MP antes de marcar como pago
- RLS permissiva (consistente com o padrão atual das tabelas julia_*)

