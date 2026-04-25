---
name: crm-builder-client-scope
description: CRM Builder boards, pipelines, deals, custom fields and automations are scoped by client_id; whole team of the same client shares them
type: feature
---
O módulo CRM Builder (`/crm-builder`) é escopado por `client_id`. Tabelas (`crm_boards`, `crm_pipelines`, `crm_deals`, `crm_custom_fields`, `crm_automation_rules`) possuem `client_id text` indexada. Filtros e realtime usam `client_id=eq.<id>`. `cod_agent` é gravado apenas como auditoria de quem criou.

Permissões: somente `role` `user` ou `admin` cria/edita/arquiva boards, pipelines, custom fields e automações (`canManage`). Demais perfis do mesmo `client_id` veem tudo e podem criar/editar/mover deals, mas não veem os botões de gerenciamento de estrutura. O diálogo `CreateCrmLeadDialog` também lista boards por `client_id`.

Auditoria: tabela `crm_audit_log` (client_id, cod_agent, entity_type ∈ board|pipeline|automation|custom_field, entity_id, entity_name, action ∈ created|updated|archived|deleted|reordered|toggled_active, changes jsonb, created_at). Helper `logCRMAudit` em `useCRMAuditLog.ts` é chamado em todas as mutations estruturais dos hooks. Hook `useCRMAuditLog` lê com filtros opcionais por `boardId`/`entityType`/`action`. UI: tab "Auditoria" em `BoardSettingsSheet` e botão global em `CRMBuilderPage` — ambos só renderizam quando `canManage`.

Realtime hardening: nomes de canal incluem `clientId` para isolar tenants. Padrão `crm-<entity>-${clientId}-${boardId}` (ou `crm-boards-${clientId}` no nível board). Filtro server-side mantém `board_id=eq.${boardId}` (mais seletivo); `client_id` é reaplicado pelo `fetch*` ao recarregar.

