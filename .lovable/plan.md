

# Módulo de Telefonia Api4Com — Sistema de Planos de Ramais

## Visão Geral

O admin cria **planos de ramais** (ex: "Básico - 5 ramais", "Premium - 20 ramais"). Cada usuário/cliente recebe um plano que limita quantos ramais pode criar. No painel do usuário, ele gerencia seus ramais dentro do limite do plano.

---

## Parte 1: Tabelas (Migração)

### `phone_extension_plans` — Planos de ramais
- `id` (serial PK), `name` (text), `max_extensions` (int), `price` (numeric), `description` (text nullable), `is_active` (boolean default true), `created_at`, `updated_at`

### `phone_user_plans` — Vínculo usuário ↔ plano
- `id` (serial PK), `user_id` (int, referência ao usuário principal), `plan_id` (int FK → phone_extension_plans), `is_active` (boolean default true), `assigned_at` (timestamptz default now())

### `phone_extensions` — Ramais criados pelos usuários
- `id` (serial PK), `user_id` (int, dono do ramal), `extension_number` (text), `assigned_member_id` (int nullable, membro da equipe vinculado), `label` (text nullable, nome amigável), `api4com_id` (text nullable), `is_active` (boolean default true), `created_at`, `updated_at`

### `phone_config` — Credenciais Api4Com por agente/cliente
- `id` (serial PK), `cod_agent` (text), `api4com_domain` (text), `api4com_token` (text), `is_active` (boolean default true), `created_at`, `updated_at`

### `phone_call_logs` — Histórico de chamadas
- `id` (serial PK), `call_id` (text), `cod_agent` (text), `extension_number` (text), `direction` (text), `caller` (text), `called` (text), `started_at` (timestamptz), `answered_at` (timestamptz nullable), `ended_at` (timestamptz nullable), `duration_seconds` (int), `hangup_cause` (text nullable), `record_url` (text nullable), `cost` (numeric nullable), `metadata` (jsonb), `created_at`

---

## Parte 2: Edge Functions

### `api4com-proxy` — Proxy para API4Com
- Ações: `dial`, `list_extensions`, `create_extension`, `update_extension`, `delete_extension`, `get_account`
- Autenticação via token salvo em `phone_config` ou secret `API4COM_TOKEN`

### `api4com-webhook` — Recebe eventos de fim de chamada
- Persiste em `phone_call_logs`

---

## Parte 3: Admin — `/admin/telefonia`

### Tabs:

1. **Planos de Ramais** — CRUD de planos (`phone_extension_plans`). Tabela com nome, qtd max ramais, preço, status ativo. Dialog para criar/editar.

2. **Vincular Planos** — Lista de usuários principais. Selecionar plano para cada um. Mostra plano atual e quantidade de ramais usados vs limite.

3. **Configuração** — Cadastrar credenciais Api4Com por agente (domínio + token).

4. **Histórico** — Tabela de chamadas com filtros (agente, período, direção). Tempo total e custo.

### Arquivos:
- `src/pages/admin/telefonia/TelefoniaAdminPage.tsx`
- `src/pages/admin/telefonia/components/PlansTab.tsx`
- `src/pages/admin/telefonia/components/PlanDialog.tsx`
- `src/pages/admin/telefonia/components/UserPlansTab.tsx`
- `src/pages/admin/telefonia/components/ConfigTab.tsx`
- `src/pages/admin/telefonia/components/CallHistoryTab.tsx`
- `src/pages/admin/telefonia/hooks/useTelefoniaAdmin.ts`
- `src/pages/admin/telefonia/types.ts`

---

## Parte 4: Usuário — `/telefonia`

### Tabs:

1. **Meus Ramais** — Lista ramais criados. Botão "Novo Ramal" (desabilitado se atingiu limite do plano). Badge mostrando "X de Y ramais". Opção de vincular ramal a membro da equipe.

2. **Discador** — Teclado numérico + seleção de ramal ativo + botão ligar.

3. **Histórico** — Chamadas do usuário com player de gravação.

4. **Relatórios** — Resumo (total chamadas, duração média, gráfico evolução).

### Arquivos:
- `src/pages/telefonia/TelefoniaPage.tsx`
- `src/pages/telefonia/components/MeusRamaisTab.tsx`
- `src/pages/telefonia/components/RamalDialog.tsx`
- `src/pages/telefonia/components/DiscadorTab.tsx`
- `src/pages/telefonia/components/DiscadorPad.tsx`
- `src/pages/telefonia/components/HistoricoTab.tsx`
- `src/pages/telefonia/components/RelatoriosTab.tsx`
- `src/pages/telefonia/components/GravacaoPlayer.tsx`
- `src/pages/telefonia/hooks/useTelefoniaData.ts`
- `src/pages/telefonia/types.ts`

---

## Parte 5: Integração no Card CRM

### `src/pages/crm/components/CRMLeadCard.tsx`

- Mover ícones de ação (Contract, Video, WhatsApp, Bot) do header para barra de badges abaixo do `[cod_agent] - Nome`
- Manter apenas Eye (detalhes) no header
- Adicionar ícone Phone na barra de badges → abre `PhoneCallDialog`

### `src/pages/crm/components/PhoneCallDialog.tsx`
- Mostra nome/número do lead
- Dropdown para selecionar ramal
- Botão ligar → chama `api4com-proxy` com ação `dial`

---

## Parte 6: Backend (externalDb + db-query)

Adicionar ações no `db-query` edge function:
- `get_phone_plans`, `create_phone_plan`, `update_phone_plan`, `delete_phone_plan`
- `get_user_phone_plan`, `assign_user_phone_plan`
- `get_user_extensions`, `create_extension`, `update_extension`, `delete_extension`
- `get_call_history`

Adicionar métodos correspondentes em `src/lib/externalDb.ts`.

---

## Parte 7: Rotas

### `src/App.tsx`
- `/admin/telefonia` → `TelefoniaAdminPage` (protegida por módulo)
- `/telefonia` → `TelefoniaPage` (protegida por módulo)

---

## Parte 8: Secret necessário

- `API4COM_TOKEN` — token de autenticação permanente da Api4Com (solicitar ao usuário via `add_secret`)

---

## Ordem de implementação

1. Migração das tabelas
2. Edge functions (`api4com-proxy`, `api4com-webhook`)
3. Ações no `db-query` + métodos no `externalDb.ts`
4. Página admin telefonia (planos + vínculo + config + histórico)
5. Página usuário telefonia (ramais + discador + histórico + relatórios)
6. Reorganização do card CRM + PhoneCallDialog
7. Rotas no App.tsx

