
# Aba "Pedidos" em /admin/chat + regra de liberação de filas

## 1. Nova aba "Pedidos" em `ChatAdminPage.tsx`

Espelho de `src/pages/admin/telefonia/components/OrdersTab.tsx`, adaptada para `queue_orders`.

- Arquivo novo: `src/pages/admin/chat/components/QueueOrdersTab.tsx`
- Hook novo: `src/pages/admin/chat/hooks/useQueueOrders.ts` com:
  - `useQueueOrders()` → SELECT em `queue_orders` ordenado por `created_at desc`, `refetchInterval: 15s`
  - `useRetryQueueProvisioning()` → `supabase.functions.invoke('queue-provision', { body: { order_id } })`
- Registrar a aba em `ChatAdminPage.tsx` com ícone `ShoppingBag` (lucide), posicionada **logo após "Planos"**, antes de "Provedores de Fila"

### Conteúdo da tabela (colunas)
NSU · Cliente (nome + e-mail) · Plano (nome + badge "+N filas extras" se `extra_queues > 0`) · Período · Total (formatado BRL a partir de `total_amount` em centavos) · Status · Criado em · Ações (Retentar quando `status='paid'` e `provisioning_error`).

### Cards de stats no topo
Total · Aguardando (`pending`) · Pagos pendentes (`paid` sem provisionar) · Liberados (`provisioned`) · Receita (soma de `paid_amount ?? total_amount` em `paid|provisioned`).

Reaproveita o componente `PaymentSettingsDialog` já usado em telefonia.

## 2. Regra: ao confirmar pagamento, SOMAR filas ao `QUEUE_LIMIT` do cliente

Hoje `useAgentQueueLimits` lê `chat_client_settings.settings.QUEUE_LIMIT` (default 1) para limitar quantas filas o cliente pode criar. A função `queue-provision` cria/ativa o `queue_user_plans`, mas **não atualiza `chat_client_settings`** — por isso o cliente não enxerga o aumento.

### Mudança em `supabase/functions/queue-provision/index.ts`

Depois de inserir o `queue_user_plans` (e antes de marcar `provisioned`):

1. Buscar `max_queues` do plano em `queue_plans` pelo `order.plan_id`.
2. Calcular **incremento** do pedido: `delta = max_queues + extra_queues`.
3. **Idempotência**: usar `metadata->>'queue_limit_applied' = 'true'` em `queue_orders` como flag. Se já estiver `true`, pular o passo 4 (evita somar duas vezes em caso de retry/webhook duplicado).
4. `UPSERT` em `chat_client_settings` para esse `client_id`, **somando ao valor atual**:
   - Se a linha não existir → INSERT com `settings = jsonb_build_object('QUEUE_LIMIT', delta)` (começa do zero contratado, sem o default 1 do front).
   - Se existir → UPDATE `settings = settings || jsonb_build_object('QUEUE_LIMIT', COALESCE((settings->>'QUEUE_LIMIT')::int, 1) + delta)` preservando demais chaves.
5. Marcar `queue_orders.metadata = metadata || {"queue_limit_applied": true, "queue_limit_delta": delta}` no mesmo update final do pedido.
6. **Não desativar** mais os `queue_user_plans` anteriores do cliente (a função faz isso hoje) — como o modelo agora é cumulativo, planos antigos continuam ativos. Mudar o `UPDATE queue_user_plans SET is_active=false ...` para ser **removido**.

### Invalidação no front
- `CheckoutStep.tsx` (em `/filas/contratar`) já faz polling do status: ao detectar `provisioned`, invalidar `['agent-queue-limits', clientId]` no React Query para o cliente ver o novo limite imediatamente.

## 3. Ajustes que identifiquei nos pedidos hoje

Olhando `queue_orders` + `queue-provision`:

- **`client_id` é `text` em `queue_orders`** mas `queue_user_plans.client_id` é `bigint`. A função já faz `Number(order.client_id)`. Vou validar no SELECT da aba (exibir "—" quando inválido) — sem migration.
- **Remover desativação de planos antigos** em `queue-provision` (modelo agora é cumulativo — ver §2.6).
- Nenhuma migration nova é necessária; toda a regra fica no edge function.

## 4. Arquivos

**Novos**
- `src/pages/admin/chat/components/QueueOrdersTab.tsx`
- `src/pages/admin/chat/hooks/useQueueOrders.ts`

**Editados**
- `src/pages/admin/chat/ChatAdminPage.tsx` — registrar aba "Pedidos"
- `supabase/functions/queue-provision/index.ts` — somar `max_queues + extra_queues` em `chat_client_settings.QUEUE_LIMIT`, com flag de idempotência; remover desativação de planos anteriores
- `src/pages/filas/contratar/steps/CheckoutStep.tsx` — invalidar `['agent-queue-limits', clientId]` ao detectar `provisioned`

## Ponto a confirmar

- **Posição da aba**: "Pedidos" logo após "Planos" está ok, ou prefere outra posição?
