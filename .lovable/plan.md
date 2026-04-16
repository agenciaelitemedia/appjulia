

## Plano: Integração Asaas com configuração no painel e registro automático de webhook

### Resumo
Adicionar o Asaas como terceiro gateway no fluxo `/comprar` (parâmetro `p=as`). A API Key e configurações ficam no mesmo dialog de configuração dos outros gateways (`PaymentSettingsDialog`). Ao salvar, o sistema registra automaticamente o webhook na conta Asaas via API.

### Alterações

**1. `PaymentSettingsDialog.tsx`** — Novo bloco Asaas
- Adicionar estado `asConfig` (gateway `asaas`, campos: `api_key`, `webhook_url`, `is_sandbox`)
- Carregar/salvar na tabela `julia_payment_config` (mesma lógica dos outros)
- Exibir webhook URL readonly: `https://zenizgyrwlonmufxnjqt.supabase.co/functions/v1/asaas-webhook`
- Ao salvar, se `api_key` preenchida, invocar Edge Function `asaas-configure-webhook` para registrar o webhook automaticamente na conta Asaas via `POST /api/v3/webhooks`

**2. `ComprarPage.tsx`** — Mapear `p=as`
- Expandir tipo `payment_gateway` para incluir `'asaas'`
- Mapear `paymentParam === 'as'` → `'asaas'`

**3. `CheckoutStep.tsx`** — Rotear para `asaas-checkout`
- Se gateway é `asaas`, invocar Edge Function `asaas-checkout`
- Label "Asaas" no resumo

**4. Edge Function `asaas-checkout/index.ts`** (nova)
- Buscar pedido e config Asaas na tabela `julia_payment_config`
- Buscar cliente por CPF/CNPJ: `GET /api/v3/customers?cpfCnpj=...`
- Se não existir, criar: `POST /api/v3/customers`
- Criar cobrança: `POST /api/v3/payments` com `billingType: CREDIT_CARD`, até 12 parcelas, repasse de taxas (markup no valor)
- `externalReference = order_id`
- Retornar `invoiceUrl` como `checkout_url`

**5. Edge Function `asaas-webhook/index.ts`** (nova)
- Receber eventos `PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED`
- Localizar pedido por `externalReference`
- Atualizar status para `paid`, gravar `paid_at`, `paid_amount`, `webhook_payload`

**6. Edge Function `asaas-configure-webhook/index.ts`** (nova)
- Receber `api_key` e `is_sandbox`
- Chamar `GET /api/v3/webhooks` para verificar se já existe webhook com a URL
- Se não existir, `POST /api/v3/webhooks` com:
  - `url`: URL do `asaas-webhook`
  - `email`: notificação
  - `events`: `["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]`
  - `enabled`: true
- Retornar sucesso/erro ao frontend

**7. `supabase/config.toml`** — Registrar as 3 funções com `verify_jwt = false`

### Fluxo de configuração
```text
Admin abre Configurações de Pagamento
  → Bloco Asaas: preenche API Key, ativa/desativa, sandbox
  → Webhook URL exibido (readonly)
  → Clica Salvar
    → Salva config no banco
    → Invoca asaas-configure-webhook → registra webhook na conta Asaas automaticamente
    → Toast de sucesso
```

### Fluxo de pagamento
```text
Cliente acessa /comprar?p=as
  → Preenche dados → Checkout invoca asaas-checkout
    → Busca/cria customer no Asaas por CPF/CNPJ
    → Cria payment com link de checkout (12x, taxas repassadas)
    → Retorna invoiceUrl → abre em nova aba
    → Asaas envia webhook → asaas-webhook atualiza order
    → Polling detecta "paid" → redireciona para sucesso
```

### Repasse de taxas
O valor da parcela será calculado com markup embutido antes de criar a cobrança, de modo que o cliente paga as taxas do cartão. Fórmula aplicada na Edge Function.

### Sem necessidade de secret no Supabase
A API Key do Asaas fica na tabela `julia_payment_config` (campo `config.api_key`), acessada pela Edge Function em runtime. Não é necessário adicionar secret separado.

