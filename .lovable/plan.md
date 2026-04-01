
# Módulo Financeiro + Melhorias no Checkout

## 1. Resgatar pedido em aberto no `/comprar`

**Problema**: Ao digitar CPF/CNPJ, se já existe um pedido `draft` ou `pending`, o sistema cria um novo duplicado.

**Solução**: No `DocumentStep.tsx`, ao encontrar pedido existente com status `draft` ou `pending`:
- Carregar o pedido completo (id, dados do cliente, plano, checkout_url)
- Pular direto para o step correto (se já tem plano → checkout; se só tem dados → seleção de plano)
- No `CustomerStep.tsx`, usar `upsert` ou `update` em vez de `insert` quando `orderData.id` já existe

**Arquivo**: `src/pages/comprar/steps/DocumentStep.tsx`, `src/pages/comprar/steps/CustomerStep.tsx`, `src/pages/comprar/ComprarPage.tsx`

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

ALTER TABLE public.julia_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read julia_plans" ON public.julia_plans FOR SELECT USING (true);
CREATE POLICY "Auth manage julia_plans" ON public.julia_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

Inserir os 3 planos atuais (Essencial R$297, Profissional R$497, Enterprise R$997) como seed.

**Arquivo novo**: `src/pages/admin/planos/PlanosPage.tsx` — CRUD de planos com formulário (nome, preço, features como tags, ícone, cor, popular, ativo, ordem).

**Arquivo alterado**: `src/pages/comprar/steps/PlanStep.tsx` — buscar planos do banco em vez de hardcoded.

---

## 3. Módulo Financeiro — Pedidos (refatorar `/admin/pedidos`)

Mover de "Administrativo" para grupo "FINANCEIRO". Adicionar:

### Filtros avançados
- **Período**: DateRangePicker (data inicial/final)
- **Status**: Select multi (draft, pending, paid, failed, cancelled)
- **Plano**: Select (buscar de `julia_plans`)
- **Busca livre**: nome, CPF/CNPJ, NSU

### Visualização detalhada (Dialog/Sheet)
Ao clicar "Visualizar" em um pedido, abrir modal com:
- **Dados do cliente**: nome, documento, email, whatsapp, endereço
- **Dados do pedido**: plano, preço, status, NSU, data de criação
- **Dados do pagamento**: valor pago, parcelas, data do pagamento, comprovante (link receipt_url), NSU da transação
- **Link do checkout**: botão para abrir checkout_url
- **Notas**: campo editável
- **Payload do webhook**: JSON formatado (colapsável)

**Arquivos**: Refatorar `src/pages/admin/pedidos/PedidosPage.tsx`, criar `OrderDetailSheet.tsx`

---

## 4. Módulo Financeiro — Planos

**Nova rota**: `/admin/planos`
**Código do módulo**: `julia_plans` (adicionar ao `ModuleCode` em `permissions.ts`)
**Grupo**: FINANCEIRO
**Categoria**: financeiro

Tela com:
- Lista de planos em cards ou tabela
- Botão "Novo Plano" → dialog com formulário
- Editar/desativar planos existentes
- Drag & drop ou campo de ordem

---

## 5. Rotas e Permissões

**`src/types/permissions.ts`**: Adicionar `'julia_plans'` ao `ModuleCode`

**`App.tsx`**: Adicionar rotas:
```tsx
<Route path="/admin/planos" element={<ProtectedRoute module="julia_plans"><PlanosPage /></ProtectedRoute>} />
```

O módulo `julia_orders` já existe. Ambos devem ser registrados no banco de módulos com `menu_group: 'FINANCEIRO'` e `category: 'financeiro'`.

---

## Resumo de arquivos

| Arquivo | Ação |
|---|---|
| Migração SQL | Criar tabela `julia_plans` + seed |
| `src/pages/comprar/steps/DocumentStep.tsx` | Resgatar pedido aberto |
| `src/pages/comprar/steps/CustomerStep.tsx` | Update em vez de insert se id existe |
| `src/pages/comprar/steps/PlanStep.tsx` | Buscar planos do banco |
| `src/pages/comprar/ComprarPage.tsx` | Ajustar step inicial baseado no pedido |
| `src/pages/admin/pedidos/PedidosPage.tsx` | Filtros avançados + tabela melhorada |
| `src/pages/admin/pedidos/components/OrderDetailSheet.tsx` | **Novo** — detalhes do pedido |
| `src/pages/admin/pedidos/hooks/useOrders.ts` | Adicionar filtros por data/status/plano |
| `src/pages/admin/planos/PlanosPage.tsx` | **Novo** — CRUD de planos |
| `src/types/permissions.ts` | Adicionar `julia_plans` |
| `App.tsx` | Adicionar rota `/admin/planos` |
