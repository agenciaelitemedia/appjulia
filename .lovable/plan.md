
# Planos de Filas + Contratação

Vamos espelhar a estrutura de **Planos de Telefonia** para criar **Planos de Filas**, com cadastro no `/admin/chat` e fluxo de contratação em `/filas/contratar`.

## 1. Banco de dados (migration)

Duas tabelas novas, espelhando `phone_extension_plans` / `phone_user_plans`:

**`queue_plans`** — catálogo gerenciado pelo admin
- `id` (bigserial PK), `name`, `description`
- `max_queues` (int) — quantas filas o plano libera
- `extra_queue_price` (numeric) — preço por fila extra
- `price_monthly | price_quarterly | price_semiannual | price_annual` (numeric)
- `setup_fee_monthly | _quarterly | _semiannual | _annual` (numeric, nullable: null=sem taxa, 0=grátis, >0=cobra)
- `is_active` (bool), `created_at`, `updated_at`

**`queue_user_plans`** — vínculo cliente → plano contratado
- `id`, `client_id` (bigint), `cod_agent` (bigint, opcional)
- `plan_id` (FK queue_plans), `billing_period`, `extra_queues`
- `is_active`, `assigned_at`, `start_date`, `due_date`
- `client_name`, `business_name`

**`queue_orders`** — pedido/checkout (espelhando `telephony_orders`)
- `id` (uuid), `client_id`, `plan_id`, `billing_period`, `extra_queues`
- `customer_name | document | email | whatsapp`
- `breakdown_cents` (jsonb), `total_cents`, `status` (`pending|paid|failed|provisioned`)
- `checkout_url`, `payment_provider`, `payment_id`, `paid_at`, `provisioned_at`

RLS: admin pode tudo; cliente vê apenas seus próprios `queue_user_plans` e `queue_orders`.

## 2. Aba "Planos" em /admin/chat

Arquivo: `src/pages/admin/chat/components/QueuePlansTab.tsx` (cópia adaptada de `PlansTab.tsx`).

- Tabela com colunas: Nome, Máx. Filas, Mensal, Trimestral, Semestral, Anual, Extra, Status, Ações
- Dialog de criação/edição: `QueuePlanDialog.tsx` (cópia adaptada de `PlanDialog.tsx`), trocando "Ramais"→"Filas" e usando `max_queues`/`extra_queue_price`
- Hook: `src/pages/admin/chat/hooks/useQueuePlansAdmin.ts` com `plans`, `createPlan`, `updatePlan`, `deletePlan` (espelhando `useTelefoniaAdmin` na parte de planos)
- Registrar nova aba em `ChatAdminPage.tsx` com ícone `CreditCard`, posicionada após "Chat" e antes de "Provedores de Fila"

## 3. Página /filas/contratar

Estrutura espelhada de `/telefonia/contratar`:

```text
src/pages/filas/contratar/
├── ContratarFilasPage.tsx       (stepper: plan → data → checkout → success)
├── types.ts                     (QueuePlan, ContractDraft, calculateTotal — mesma lógica)
└── steps/
    ├── SelectPlanStep.tsx       (lista cards + periodicidade + filas extras + addons)
    ├── ConfirmDataStep.tsx      (nome, CPF/CNPJ, email, whatsapp)
    └── CheckoutStep.tsx         (iframe/redirect + polling de status)
```

Diferenças vs telefonia:
- Sem toggles `recording_enabled` / `transcription_enabled` (não se aplicam a filas) — só plano + filas extras + período
- Texto e ícones do domínio "filas/atendimento" (lucide `MessageSquare`, `Network`)
- Endpoint do checkout: `queue-order-create` / `queue-order-checkout` (novos)

## 4. Edge functions

Três novas funções espelhadas:

- **`queue-order-create`** — valida `client_id`, plano e total (compara `client_breakdown_cents` com cálculo do servidor), cria linha em `queue_orders` com `status=pending`
- **`queue-order-checkout`** — gera URL de pagamento (Mercado Pago ou InfinityPay, mesmo provider já usado em telefonia)
- **`queue-provision`** — chamada via webhook de pagamento: ativa o plano em `queue_user_plans` (desativa anteriores do mesmo cliente) e marca `queue_orders.status=provisioned`

Reaproveitar webhooks existentes (`mercadopago-webhook` / `infinitypay-webhook`): adicionar branch que detecta `order_type=queue` no metadata e chama `queue-provision`.

## 5. Rota e menu

- Rota `/filas/contratar` em `src/App.tsx` (lazy import), envolvida por `ProtectedRoute`
- Botão "Contratar Filas" na página de filas do cliente (`src/pages/agente/filas/...`) — apontando para `/filas/contratar`
- Permissão herdada do módulo Filas já existente (sem novo permission key)

## 6. Detalhes técnicos

- **Tipos compartilhados**: `QueueBillingPeriod = 'monthly'|'quarterly'|'semiannual'|'annual'` reutilizando `PERIOD_MONTHS` / `PERIOD_LABELS` já existentes em `src/pages/telefonia/contratar/types.ts` (extrair para `src/lib/billingPeriods.ts` se quiser deduplicar; caso contrário, copiar)
- **Bigint**: `client_id` e `cod_agent` em `queue_user_plans` devem ser `bigint` (regra de projeto)
- **Cálculo de preço**: `calculateTotal()` espelhada — `plan_total + setup + (extra_queues * extra_queue_price * months)` (sem recording/transcription)
- **Validação cruzada**: front envia `client_breakdown_cents`; edge function recalcula e loga divergência (mesmo padrão da telefonia)
- **Datas**: `due_date = start_date + PERIOD_MONTHS[period]` via `date-fns/addMonths`
- **Polling de provisionamento**: `CheckoutStep` faz polling em `queue_orders.status` até virar `provisioned`

## Arquivos criados/editados

Novos:
- `supabase/migrations/<ts>_queue_plans.sql`
- `src/pages/admin/chat/components/QueuePlansTab.tsx`
- `src/pages/admin/chat/components/QueuePlanDialog.tsx`
- `src/pages/admin/chat/hooks/useQueuePlansAdmin.ts`
- `src/pages/filas/contratar/ContratarFilasPage.tsx`
- `src/pages/filas/contratar/types.ts`
- `src/pages/filas/contratar/steps/SelectPlanStep.tsx`
- `src/pages/filas/contratar/steps/ConfirmDataStep.tsx`
- `src/pages/filas/contratar/steps/CheckoutStep.tsx`
- `supabase/functions/queue-order-create/index.ts`
- `supabase/functions/queue-order-checkout/index.ts`
- `supabase/functions/queue-provision/index.ts`

Editados:
- `src/pages/admin/chat/ChatAdminPage.tsx` (nova aba "Planos")
- `src/App.tsx` (rota `/filas/contratar`)
- `supabase/functions/mercadopago-webhook/index.ts` e/ou `infinitypay-webhook/index.ts` (branch `order_type=queue`)

## Pontos a confirmar antes de implementar

1. **Pagamento**: usar Mercado Pago (padrão do projeto) para `/filas/contratar`?
2. **Provisionamento**: ao pagar, só ativa o plano em `queue_user_plans` (libera contador de filas) — a criação efetiva de cada fila continua manual em `/admin/chat → Provedores de Fila`, certo?
3. **Addons de gravação/transcrição**: confirmo que NÃO se aplicam a filas? (telefonia tem; filas teria algum addon equivalente, tipo "IA" / "histórico estendido"?)
