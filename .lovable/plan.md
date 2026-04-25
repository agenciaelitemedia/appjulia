## Diagnóstico (já feito)

Consultei as tabelas do CRM Builder no banco:

| Tabela | Total | Com `client_id` | Nulos |
|---|---|---|---|
| `crm_boards` | 4 | 4 | **0** |
| `crm_pipelines` | 17 | 17 | **0** |
| `crm_deals` | 3 | 3 | **0** |
| `crm_custom_fields` | 0 | 0 | **0** |
| `crm_automation_rules` | 2 | 2 | **0** |

**Resultado**: o backfill executado na migração anterior cobriu 100% das linhas. Não há `client_id` nulo. Vou apenas gerar um relatório formal (markdown em `/mnt/documents/crm-builder-backfill-report.md`) confirmando o estado e listando os `client_id`s ativos.

Sobre realtime: hoje os hooks `useCRMPipelines`, `useCRMDeals`, `useCRMCustomFields` e `useCRMAutomations` filtram a subscription apenas por `board_id`. Como `board_id` é UUID único globalmente não há vazamento prático entre clientes, mas falta defesa em profundidade — vou adicionar `client_id` ao filtro e isolar nome do canal.

---

## 1. Relatório de backfill (entregável)

Gerar `/mnt/documents/crm-builder-backfill-report.md` contendo:
- Resumo das 5 tabelas (total / preenchidas / nulas — todas 0 nulas).
- Lista distinta de `client_id`s presentes em cada tabela, com `cod_agent`s associados (mapeamento auditoria).
- Confirmação de que nenhuma linha precisou ser atualizada nesta rodada.
- Procedimento idempotente para futuro (caso surjam novas linhas órfãs): UPDATE setando `client_id` a partir do `agents.client_id` via `cod_agent`.

Não haverá `UPDATE` no banco — tudo já está preenchido.

## 2. Auditoria estrutural (boards / pipelines / automations / custom fields)

### 2.1 Migração (nova tabela `crm_audit_log`)
```sql
CREATE TABLE public.crm_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  cod_agent text NOT NULL,           -- quem executou
  entity_type text NOT NULL,         -- 'board' | 'pipeline' | 'automation' | 'custom_field'
  entity_id uuid NOT NULL,
  entity_name text,                  -- snapshot do nome no momento
  action text NOT NULL,              -- 'created' | 'updated' | 'archived' | 'deleted' | 'reordered' | 'toggled_active'
  changes jsonb DEFAULT '{}'::jsonb, -- diff/payload
  created_at timestamptz DEFAULT now()
);
CREATE INDEX ON public.crm_audit_log(client_id, created_at DESC);
CREATE INDEX ON public.crm_audit_log(entity_type, entity_id);
```
Sem RLS (mesmo padrão das demais tabelas `crm_*` do builder); isolamento na aplicação por `client_id`.

### 2.2 Gravar logs nos hooks
Adicionar helper `logAudit(...)` chamado em:
- `useCRMBoards`: `createBoard`, `updateBoard`, `archiveBoard`, `reorderBoards`.
- `useCRMPipelines`: `createPipeline`, `updatePipeline`, `deletePipeline`, `reorderPipelines`.
- `useCRMAutomations`: `createRule`, `updateRule`, `toggleRuleActive`, `deleteRule`.
- `useCRMCustomFields`: `createField`, `updateField`, `deleteField`, `reorderFields`.

Cada chamada grava `{client_id, cod_agent, entity_type, entity_id, entity_name, action, changes}` (silent-fail, igual ao `crm_deal_history`).

### 2.3 Hook `useCRMAuditLog`
Novo hook em `src/pages/crm-builder/hooks/useCRMAuditLog.ts`:
- Recebe `{ clientId, boardId?, entityType?, limit }`.
- `SELECT * FROM crm_audit_log WHERE client_id=$1 [AND ...] ORDER BY created_at DESC LIMIT 100`.
- Retorna entradas com `cod_agent`, `entity_type`, `entity_name`, `action`, `created_at`, `changes`.

### 2.4 UI — aba "Auditoria"
- Em `BoardSettingsSheet.tsx` (settings do board) adicionar nova tab **Auditoria** ao lado de Custom Fields e Automações, **só renderizada se `canManage`** (dono/admin).
- Componente `AuditLogPanel`:
  - Lista cronológica (timeline) com badge da entidade (Board / Pipeline / Automação / Campo), ação (criou/editou/arquivou/removeu), nome, `cod_agent` (quem fez), e `created_at` formatado (`dd/MM/yyyy HH:mm`).
  - Filtros simples: tipo de entidade, ação.
  - Empty state amigável.
- Em `CRMBuilderPage` (grid de boards), adicionar botão "Auditoria" no header **só para `canManage`** abrindo um Sheet/Dialog com auditoria global do `client_id` (todos os boards).

## 3. Hardening do realtime (defesa em profundidade)

Ajustar todos os hooks para que a subscription:
1. Inclua `client_id` no nome do canal (evita colisão entre clientes que abrem o mesmo board id por engano em multi-tenant).
2. Não confie em `board_id` global — manter filtro server-side por `board_id` (e deixar filtragem de `client_id` redundante via re-fetch, que já lê `.eq('client_id', clientId)`).

Mudanças concretas:

| Hook | Canal antes | Canal depois | Filtro server-side |
|---|---|---|---|
| `useCRMBoards` | `crm-boards-changes` | `crm-boards-${clientId}` | `client_id=eq.${clientId}` (já tem) |
| `useCRMPipelines` | `crm-pipelines-${boardId}` | `crm-pipelines-${clientId}-${boardId}` | `board_id=eq.${boardId}` (mantém; refetch reaplica `client_id`) |
| `useCRMDeals` | `crm-deals-${boardId}` | `crm-deals-${clientId}-${boardId}` | `board_id=eq.${boardId}` |
| `useCRMCustomFields` | `crm-custom-fields-${boardId}` | `crm-custom-fields-${clientId}-${boardId}` | `board_id=eq.${boardId}` |
| `useCRMAutomations` | `crm-automations-${boardId}` | `crm-automations-${clientId}-${boardId}` | `board_id=eq.${boardId}` |

Também adicionar guard `if (!clientId) return;` em todos os `useEffect` de subscription (alguns só checam `boardId`).

Justificativa para manter filtro server-side por `board_id` em vez de `client_id`: o realtime do Postgres só aceita 1 filtro `eq` por subscription. Como `board_id` é mais seletivo (notifica só do board aberto) e o `fetchX` já restringe leituras por `client_id`, mantemos `board_id` no filtro e usamos `client_id` no nome do canal para evitar conflito de canais entre tenants.

## 4. Memória

Atualizar `mem://features/crm/builder-client-scope.md` adicionando:
- Existência de `crm_audit_log`.
- Padrão de canal realtime `crm-<entity>-${clientId}-${boardId}`.

## 5. Validações pós-deploy

- Editar nome de um board como dono → entrada aparece em Auditoria com `cod_agent` e timestamp.
- Arquivar pipeline → linha "archived" no log.
- Criar automação e togglar ativo → 2 linhas no log.
- Membro da equipe não vê o botão "Auditoria" nem a tab.
- Abrir 2 navegadores com `client_id`s diferentes — subscriptions não colidem (canais separados).

## Arquivos a editar/criar

**Criar**
- `supabase/migrations/<ts>_crm_audit_log.sql`
- `src/pages/crm-builder/hooks/useCRMAuditLog.ts`
- `src/pages/crm-builder/components/audit/AuditLogPanel.tsx`
- `/mnt/documents/crm-builder-backfill-report.md` (artifact)

**Editar**
- `src/pages/crm-builder/hooks/useCRMBoards.ts` (audit + canal realtime)
- `src/pages/crm-builder/hooks/useCRMPipelines.ts` (audit + canal realtime)
- `src/pages/crm-builder/hooks/useCRMDeals.ts` (canal realtime)
- `src/pages/crm-builder/hooks/useCRMCustomFields.ts` (audit + canal realtime)
- `src/pages/crm-builder/hooks/useCRMAutomations.ts` (audit + canal realtime)
- `src/pages/crm-builder/components/settings/BoardSettingsSheet.tsx` (nova tab Auditoria)
- `src/pages/crm-builder/CRMBuilderPage.tsx` (botão Auditoria global p/ dono/admin)
- `mem/features/crm/builder-client-scope.md`

## Fora do escopo
- Não vamos habilitar RLS nas tabelas `crm_*` (mantém padrão atual).
- Não vamos auditar mudanças em `crm_deals` (já existe `crm_deal_history`).
