

# Módulo Financeiro + Melhorias no Checkout

## 1. Resgatar pedido em aberto no `/comprar`

**Problema**: Ao digitar CPF/CNPJ, se já existe um pedido `draft` ou `pending`, o sistema cria um novo duplicado.

**Solução**: No `DocumentStep.tsx`, ao encontrar pedido existente com status `draft` ou `pending`:
- Carregar o pedido completo (id, dados do cliente, plano, checkout_url)
- Pular direto para o step correto (se já tem plano → checkout; se só tem dados → seleção de plano)
- No `CustomerStep.tsx`, usar `update` em vez de `insert` quando `orderData.id` já existe

**Arquivos**: `DocumentStep.tsx`, `CustomerStep.tsx`, `ComprarPage.tsx`

---

## 2. Tabela `julia_plans` — Cadastro de Planos

**Nova tabela** via migração:

```sql
CREATE TABLE public.julia_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price integer NOT NULL DEFAULT 0,
  price_display text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT 'zap',
  color text NOT NULL DEFAULT 'from-blue-500 to-blue-600',
  features jsonb NOT NULL DEFAULT '[]',
  is_popular boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

Seed com os 3 planos atuais (Essencial R$297, Profissional R$497, Enterprise R$997).

---

## 3. Módulo Financeiro — Pedidos (refatorar `/admin/pedidos`)

### Filtros avançados
- **Período**: DateRangePicker
- **Status**: Select multi (draft, pending, paid, failed, cancelled)
- **Plano**: Select (buscar de `julia_plans`)
- **Busca livre**: nome, CPF/CNPJ, NSU

### Visualização detalhada (Sheet lateral)
Ao clicar "Visualizar":
- Dados do cliente (nome, documento, email, whatsapp, endereço)
- Dados do pedido (plano, preço, status, NSU, data)
- Dados do pagamento (valor pago, parcelas, data, comprovante receipt_url, NSU transação)
- Link do checkout (botão)
- Notas e payload do webhook (colapsável)

---

## 4. Módulo Financeiro — Cadastro de Planos

**Nova rota**: `/admin/planos`

Tela com:
- Lista de planos em tabela
- Botão "Novo Plano" → dialog com formulário (nome, preço, features como tags, ícone, cor, popular, ativo, ordem)
- Editar/desativar planos

---

## 5. Checkout busca planos do banco

`PlanStep.tsx` passa a buscar de `julia_plans` em vez de hardcoded.

---

## 6. Rotas e Permissões

- Adicionar `'julia_plans'` ao `ModuleCode` em `permissions.ts`
- Rota `/admin/planos` protegida por `julia_plans`
- Ambos módulos (`julia_orders` e `julia_plans`) no grupo `FINANCEIRO`, categoria `financeiro`

---

## Resumo de arquivos

| Arquivo | Ação |
|---|---|
| Migração SQL | Criar `julia_plans` + seed + RLS |
| `DocumentStep.tsx` | Resgatar pedido draft/pending |
| `CustomerStep.tsx` | Update se id existe |
| `ComprarPage.tsx` | Step inicial baseado no pedido |
| `PlanStep.tsx` | Buscar planos do banco |
| `PedidosPage.tsx` | Filtros avançados + tabela |
| `OrderDetailSheet.tsx` | **Novo** — detalhes do pedido |
| `useOrders.ts` | Filtros por data/status/plano |
| `PlanosPage.tsx` | **Novo** — CRUD de planos |
| `permissions.ts` | Adicionar `julia_plans` |
| `App.tsx` | Rota `/admin/planos` |

