

# Adicionar Preços por Período (Mensal/Semestral/Anual) aos Planos Julia

## Resumo

Atualmente a tabela `julia_plans` tem apenas `price` (único valor em centavos) e `price_display`. O usuário quer que cada plano tenha preços diferenciados por período: **mensal**, **semestral** e **anual** — igual ao modelo já usado em `phone_extension_plans`.

## Alterações

### 1. Migração SQL — Adicionar colunas de preço por período

```sql
ALTER TABLE julia_plans 
  ADD COLUMN price_monthly integer NOT NULL DEFAULT 0,
  ADD COLUMN price_semiannual integer NOT NULL DEFAULT 0,
  ADD COLUMN price_annual integer NOT NULL DEFAULT 0;

-- Copiar o preço atual para mensal
UPDATE julia_plans SET price_monthly = price;
```

### 2. Admin — `PlanosPage.tsx`

- Adicionar campos no formulário: **Mensal (R$)**, **Semestral (R$)**, **Anual (R$)** (em centavos)
- Salvar/carregar os três novos campos
- Exibir na tabela os 3 preços

### 3. Checkout — `PlanStep.tsx`

- Adicionar seletor de período (Mensal / Semestral / Anual) com toggle ou tabs
- Mostrar o preço correspondente ao período selecionado no card do plano
- Passar `billing_period` e o preço correto para `OrderData`

### 4. `ComprarPage.tsx` — OrderData

- Adicionar campo `billing_period: 'monthly' | 'semiannual' | 'annual'` ao tipo `OrderData`

### 5. `CheckoutStep.tsx`

- Exibir o período selecionado no resumo (ex: "/mês", "/semestre", "/ano")
- Salvar `billing_period` no pedido ao criar/atualizar `julia_orders`

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| Migração SQL | 3 novas colunas em `julia_plans` |
| `src/pages/admin/planos/PlanosPage.tsx` | Campos de preço por período no CRUD |
| `src/pages/comprar/ComprarPage.tsx` | `billing_period` no OrderData |
| `src/pages/comprar/steps/PlanStep.tsx` | Seletor de período + preço dinâmico |
| `src/pages/comprar/steps/CheckoutStep.tsx` | Exibir período no resumo |

