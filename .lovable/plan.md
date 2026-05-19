
# Plano: Contratação de Videochamadas + Admin VideoChamadas

Implementar o fluxo completo de contratação de planos de videochamada (Daily.co), espelhando o padrão já consolidado de `/telefonia/contratar` e `/admin/telefonia`. Inclui módulo admin com abas de **Planos** (CRUD) e **Pedidos** (similar ao `/admin/chat` / `OrdersTab` de telefonia), além do seed dos 3 planos sugeridos (Light, Pro, Escritório).

---

## 1. Banco de dados (migration)

### 1.1 Tabela `video_plans`
Espelha `phone_extension_plans`, trocando ramais por minutos.

```text
id                       serial PK
name                     text NOT NULL              -- 'Light', 'Pro', 'Escritório'
slug                     text UNIQUE                -- 'light' | 'pro' | 'office'
included_minutes         integer NOT NULL           -- minutos/mês inclusos (participant-minutes)
max_concurrent_rooms     integer NOT NULL           -- salas simultâneas
recording_included       boolean DEFAULT false
transcription_included   boolean DEFAULT false
price_monthly            numeric NOT NULL DEFAULT 0
price_quarterly          numeric NOT NULL DEFAULT 0
price_semiannual         numeric NOT NULL DEFAULT 0
price_annual             numeric NOT NULL DEFAULT 0
extra_minutes_pack_size  integer DEFAULT 1000       -- pacote extra (ex.: 1000 min)
extra_minutes_pack_price numeric DEFAULT 0          -- preço do pacote extra
setup_fee_monthly/quarterly/semiannual/annual  numeric NULL
description              text
is_active                boolean DEFAULT true
sort_order               integer DEFAULT 0
created_at / updated_at  timestamptz
```
RLS: `Allow all` (idêntico a `phone_extension_plans`); UI restrita por `AdminRoute`.

### 1.2 Tabela `video_orders`
Espelha `telephony_orders`:
```text
id uuid PK, client_id text, customer_* (name/document/email/whatsapp),
plan_id int FK → video_plans, plan_name text,
billing_period text ('monthly'|'quarterly'|'semiannual'|'annual'),
extra_minute_packs int DEFAULT 0,
recording_enabled bool, transcription_enabled bool,
plan_price/setup_fee/recording_total/transcription_total/extras_total/total_amount  integer (centavos),
status text DEFAULT 'draft' ('draft'|'pending'|'paid'|'provisioned'|'failed'|'cancelled'),
payment_gateway text DEFAULT 'mercadopago',
checkout_url, mp_preference_id, mp_payment_id, order_nsu text,
paid_at, provisioned_at timestamptz,
paid_amount/net_amount/fee_amount int,
provisioning_error text, metadata jsonb, webhook_payload jsonb,
user_plan_id bigint NULL,
created_at/updated_at timestamptz
```
Índices em `client_id`, `status`, `mp_preference_id`. RLS: insert/update abertos (igual telephony_orders) + select público (necessário p/ admin).

### 1.3 Tabela `video_user_plans` (assinatura ativa do cliente)
```text
id bigserial PK, client_id text NOT NULL,
plan_id int FK → video_plans,
billing_period text, status text ('active'|'cancelled'|'expired'),
minutes_quota int, minutes_used int DEFAULT 0,
max_concurrent_rooms int,
recording_enabled bool, transcription_enabled bool,
period_start timestamptz, period_end timestamptz,
activated_at, cancelled_at timestamptz,
metadata jsonb, created_at/updated_at
```
Trigger de `updated_at`.

### 1.4 Seed dos 3 planos sugeridos (insert tool, em reais)

| Slug | Nome | Minutos | Salas Simult. | Recording | Transcrição | Mensal | Trim. | Sem. | Anual | Extra |
|---|---|---|---|---|---|---|---|---|---|---|
| light  | Light       | 5.000  | 2 | – | – | 197  | 561 (-5%)   | 1.064 (-10%) | 1.999 (-15%) | R$ 49 / 1.000 min |
| pro    | Pro         | 20.000 | 5 | ✓ (add-on R$99/m) | – | 497  | 1.416 (-5%) | 2.685 (-10%) | 5.069 (-15%) | R$ 39 / 1.000 min |
| office | Escritório  | 50.000 | 15 | ✓ incluso | ✓ incluso | 1.197 | 3.411 | 6.464 | 12.205 | R$ 29 / 1.000 min |

Setup fee: 0 para todos.

---

## 2. Edge Functions

Espelham 1:1 as de telefonia (copiar e adaptar):

- `video-order-create` — valida plano + breakdown vs servidor (centavos), cria `video_orders` status `draft`.
- `video-order-checkout` — gera preferência MercadoPago, atualiza `checkout_url`+`mp_preference_id`, status → `pending`.
- `video-provision` — chamada pelo webhook MP / botão admin "Confirmar pagamento": cria/renova `video_user_plans`, define quota, `period_start/end`, status do pedido → `provisioned`. Em erro grava `provisioning_error` e status `failed`.
- Reaproveitar `mercadopago-webhook` (adicionar handler `video_order` via `external_reference`).

Padrão de auth: `verify_jwt = false` para webhook; demais validam JWT do chamador (igual telephony).

---

## 3. Frontend — Contratação `/video/contratar`

Cópia estrutural de `src/pages/telefonia/contratar/`:

```text
src/pages/video/contratar/
  ContratarVideoPage.tsx          (Stepper Plano → Dados → Pagamento → Pronto)
  types.ts                        (VideoPlan, ContractDraft, calculateTotal)
  steps/SelectPlanStep.tsx        (3 cards de plano + toggle período + extras de minutos)
  steps/ConfirmDataStep.tsx       (form customer_* com máscara CPF/CNPJ; pré-preenche via useAuth)
  steps/CheckoutStep.tsx          (iframe/redirect MP + polling de status do pedido)
```

- Resumo lateral igual telefonia (plano + setup + extras + add-ons).
- Toggle Gravação/Transcrição: oculto se `recording_included`/`transcription_included` = true; cobrado como add-on R$99/mês caso contrário.
- Comparativo cliente×servidor (`client_breakdown_cents` / `expected_total_cents`) idêntico ao telefonia.
- Rota registrada em `src/App.tsx` dentro de `MainLayout` + `ProtectedRoute`.
- Link "Contratar" no header de `/video` (VideoQueuePage) quando cliente não tem `video_user_plans` ativo.

---

## 4. Frontend — Admin `/admin/video`

Nova página `src/pages/admin/video/VideoAdminPage.tsx` com `Tabs` (padrão `TelefoniaAdminPage`):

### Aba **Planos** (`PlansTab.tsx`)
- Tabela: Nome, Minutos, Salas Simult., Recording/Transcrição (badges), Preços (mensal destacado, tooltip dos demais períodos), Status, Ações.
- Botão **Novo plano** → `PlanDialog.tsx` (form completo com todos os campos da tabela).
- Ações por linha: Editar (mesmo dialog), Ativar/Desativar (toggle `is_active`), Excluir (AlertDialog dupla confirmação, igual padrão `secure-deletion-workflow`).
- Hook `useVideoPlans.ts` (list/create/update/delete via supabase client).

### Aba **Pedidos** (`OrdersTab.tsx`)
Espelha `src/pages/admin/telefonia/components/OrdersTab.tsx` + `useTelephonyOrders`:
- Lista `video_orders` com refetch 15s.
- Filtros: status, cliente (search), período.
- Colunas: criado em, cliente, plano, período, total (R$), gateway, status (badge), ações.
- Ações: **Abrir checkout**, **Confirmar pagamento manual** (chama `video-provision`), **Cancelar**, **Excluir**, **Reprocessar provisionamento**.
- Drawer/Dialog de detalhes: breakdown, payload MP, erros de provisionamento, `video_user_plans` gerado.

### Aba **Assinaturas** (opcional, recomendada)
Lista `video_user_plans` por cliente: quota, minutos usados, vigência, botão "Renovar"/"Cancelar".

Hooks novos:
- `src/pages/admin/video/hooks/useVideoPlans.ts`
- `src/pages/admin/video/hooks/useVideoOrders.ts` (espelho de `useTelephonyOrders`)
- `src/pages/admin/video/hooks/useVideoUserPlans.ts`

---

## 5. Integração com módulo `/video` existente

- `useVideoRoom.ts` antes de criar sala: validar `video_user_plans` ativo do `client_id` e `max_concurrent_rooms` (consulta `video_call_records` em chamadas abertas).
- Após encerrar chamada (já há `duration_seconds` em `video_call_records`): trigger SQL ou edge que incrementa `minutes_used` (`duration_seconds/60 * participants`).
- Banner em `/video` quando `minutes_used >= 80% quota` com CTA → `/video/contratar`.
- Bloqueio quando quota esgotada / sem plano: redirecionar `/video/contratar`.

---

## 6. Menu, permissões e módulos

- Inserir em `client_modules` (via `useEnsureVideoAdminModule` similar aos `useEnsure*Module`):
  - `video.contratar` (cliente)
  - `video.admin` (admin) com sub-itens `planos`, `pedidos`, `assinaturas`.
- Sidebar: link "Videochamadas" em Admin (ícone `Video` lucide).
- `ProtectedRoute` com `permission="video.admin"` na rota `/admin/video`.

---

## 7. Detalhes técnicos relevantes

- **Moedas**: planos em `numeric` (R$), pedidos em `integer` centavos — igual telefonia.
- **Validação de preço servidor**: replicar `client_breakdown_cents` vs `server_breakdown_cents` com warning toast quando divergir.
- **MercadoPago**: reusar credenciais e `mercadopago-checkout`/`mercadopago-webhook`; discriminar `external_reference = video_order:{id}`.
- **Cron de expiração** (opcional, fase 2): job diário que expira `video_user_plans` com `period_end < now()`.
- **Auditoria**: gravar em `metadata` quem confirmou pagamento manual (admin user_id + timestamp).
- **Margem**: custo Daily ≈ $0.004/participant-min × 5.50 BRL — margens validadas: Light ~75%, Pro ~67%, Escritório ~63%.

---

## 8. Ordem de execução sugerida

1. Migration (`video_plans`, `video_orders`, `video_user_plans`) + seed dos 3 planos.
2. Edge functions `video-order-create`, `video-order-checkout`, `video-provision` + hook no `mercadopago-webhook`.
3. Página `/video/contratar` (steps + hook).
4. Admin `/admin/video` (PlansTab + PlanDialog).
5. Admin OrdersTab + ações (confirmar/cancelar/excluir/reprocessar).
6. Aba Assinaturas.
7. Enforcement de quota / `max_concurrent_rooms` em `useVideoRoom`.
8. Sidebar + módulo + permissões + banner CTA em `/video`.

---

## 9. Fora de escopo (próximas iterações)

- Cobrança automática por minuto excedente (overage billing).
- Notificações push/whatsapp em 80% / 100% de quota.
- Relatório de consumo por atendente em `/admin/video`.
- Upgrade/downgrade pró-rata no meio do período.
