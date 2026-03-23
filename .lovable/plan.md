

# Reestruturação da Tela de Telefonia Admin

## Visao Geral
Reorganizar completamente a pagina `/admin/telefonia` com 4 abas reordenadas: **Agentes → Planos → Configuração → Historico**. Aba "Agentes" vira a principal com fluxo completo de cadastro. Config simplificada (1 webhook, 1 config global). Historico identico ao do cliente mas com todos os agentes.

---

## 1. Migração de Banco — Reestruturar tabelas

### 1.1 Alterar `phone_extension_plans` — adicionar periodos
```sql
ALTER TABLE phone_extension_plans
  ADD COLUMN IF NOT EXISTS price_monthly numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_quarterly numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_semiannual numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_annual numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_extension_price numeric NOT NULL DEFAULT 0;
```
A coluna `price` existente permanece (backward compat) mas o PlanDialog passará a usar os 4 campos de periodo.

### 1.2 Alterar `phone_user_plans` — dados completos do vínculo
```sql
ALTER TABLE phone_user_plans
  ADD COLUMN IF NOT EXISTS billing_period text NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS extra_extensions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS start_date date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS client_name text,
  ADD COLUMN IF NOT EXISTS business_name text;
```
`billing_period` aceita: `monthly`, `quarterly`, `semiannual`, `annual`.
`due_date` é calculado automaticamente a partir de `start_date` + período.

---

## 2. Aba "Agentes" (nova, substitui UserPlansTab)

### 2.1 Componente `AgentsTelefoniaTab.tsx`
**Layout**:
- Botão "Adicionar Telefonia" no header → abre popup `AddTelefoniaDialog`
- Filtros: busca por cod_agent, nome, escritório + select de status (Ativo/Vencido/Todos)
- Tabela com colunas:
  - Status (badge verde/vermelho)
  - Cod Agent
  - Nome / Escritório (empilhado, padrão do sistema)
  - Plano (nome)
  - Ramais (X do plano + Y extras = Z total)
  - Período (Mensal/Trimestral/Semestral/Anual)
  - Datas (Cadastro e Vencimento empilhados)
  - Valor (valor do plano no período + valor extras)

### 2.2 Componente `AddTelefoniaDialog.tsx`
**Fluxo**:
1. Campo de busca de agente — usa `externalDb.searchAgents(term)` já existente
2. Lista agentes encontrados para seleção
3. Após selecionar agente, exibe:
   - Select de Plano (lista planos ativos)
   - Select de Período (Mensal/Trimestral/Semestral/Anual) — mostra preço correspondente
   - Input de Ramais Extras (número) — mostra preço unitário do ramal extra × quantidade
   - Resumo: Valor total = preço período + (extras × preço extra)
4. Botão "Confirmar" → cria registro em `phone_user_plans` com todos os dados

### 2.3 Hook `useTelefoniaAdmin.ts` — ajustes
- `assignPlan` → expandir para receber `billing_period`, `extra_extensions`, `client_name`, `business_name`
- Calcular `due_date` automaticamente: start + 1/3/6/12 meses conforme período
- Query `userPlans` → join com `phone_extension_plans` para trazer nome do plano, max_extensions, preço do período
- Identificar "vencido" quando `due_date < today`

---

## 3. Aba "Planos" — atualizar dialog

### `PlanDialog.tsx`
- Manter: Nome, Max Ramais, Descrição, Ativo
- Remover: campo `Preço` único
- Adicionar: 4 campos de preço (Mensal, Trimestral, Semestral, Anual)
- Adicionar: campo "Preço Ramal Extra"
- `PlansTab.tsx`: atualizar colunas da tabela para mostrar os 4 preços

---

## 4. Aba "Configuração" — simplificar

### `ConfigTab.tsx`
- Seção Webhook: manter apenas a URL para copiar. Remover botões "Configurar webhook — {agente}" (webhook é unico, configurado manualmente na conta do provedor).
- Seção Config: apenas 1 formulario com Dominio API, Token, Dominio SIP. Sem campo "Cod Agente" (é config global).
- Se já existe config no banco, exibe para edição. Se não, formulário de criação.
- Remover listagem de múltiplas configs na tabela.

---

## 5. Aba "Historico" — reutilizar componente do cliente

### `CallHistoryAdminTab.tsx`
- Reutilizar o `HistoricoTab` existente (ou extrair componentes compartilhados)
- Diferença: lista de agentes vem de **todos os `phone_user_plans` ativos** (não apenas do cod_agent logado)
- Usar `useCallHistoryQuery` sem filtro de `cod_agent` fixo — filtrar client-side pelo seletor de agentes
- Precisa de uma versão do `useCallHistoryQuery` que aceite múltiplos cod_agents ou nenhum filtro server-side de agent
- Extensões: carregar de todos os agentes cadastrados na telefonia

---

## 6. Ordem das abas no `TelefoniaAdminPage.tsx`

```
Agentes | Planos | Configuração | Histórico
```

---

## Arquivos a criar/editar

| Arquivo | Ação |
|---|---|
| **Migration SQL** | Adicionar colunas em `phone_extension_plans` e `phone_user_plans` |
| `src/pages/admin/telefonia/TelefoniaAdminPage.tsx` | Reordenar abas, trocar nomes |
| `src/pages/admin/telefonia/components/AgentsTelefoniaTab.tsx` | **Novo** — substitui UserPlansTab |
| `src/pages/admin/telefonia/components/AddTelefoniaDialog.tsx` | **Novo** — popup de cadastro |
| `src/pages/admin/telefonia/components/PlansTab.tsx` | Atualizar colunas (4 preços + preço extra) |
| `src/pages/admin/telefonia/components/PlanDialog.tsx` | Campos de preço por período + extra |
| `src/pages/admin/telefonia/components/ConfigTab.tsx` | Simplificar: 1 config global, remover botões webhook |
| `src/pages/admin/telefonia/components/CallHistoryAdminTab.tsx` | **Novo** — historico admin com todos os agentes |
| `src/pages/admin/telefonia/hooks/useTelefoniaAdmin.ts` | Ajustar mutations e queries para novos campos |
| `src/pages/admin/telefonia/types.ts` | Atualizar interfaces PhonePlan, PhoneUserPlan |
| `src/pages/telefonia/hooks/useCallHistoryQuery.ts` | Tornar `codAgent` opcional ou aceitar array para admin |
| `src/pages/admin/telefonia/components/UserPlansTab.tsx` | **Remover** (substituído por AgentsTelefoniaTab) |
| `src/pages/admin/telefonia/components/CallHistoryTab.tsx` | **Remover** (substituído por CallHistoryAdminTab) |

