---
name: crm-builder-client-scope
description: CRM Builder boards, pipelines, deals, custom fields and automations are scoped by client_id; whole team of the same client shares them
type: feature
---
O módulo CRM Builder (`/crm-builder`) é escopado por `client_id`. Tabelas (`crm_boards`, `crm_pipelines`, `crm_deals`, `crm_custom_fields`, `crm_automation_rules`) possuem `client_id text` indexada. Filtros e realtime usam `client_id=eq.<id>`. `cod_agent` é gravado apenas como auditoria de quem criou.

Permissões: somente `role` `user` ou `admin` cria/edita/arquiva boards, pipelines, custom fields e automações (`canManage`). Demais perfis do mesmo `client_id` veem tudo e podem criar/editar/mover deals, mas não veem os botões de gerenciamento de estrutura. O diálogo `CreateCrmLeadDialog` também lista boards por `client_id`.
