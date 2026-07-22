# db-query — Action Contracts

> Documentação gerada automaticamente a partir de `supabase/functions/db-query/index.ts`.
> Cada action é invocada via `supabase.functions.invoke("db-query", { body: { action, data } })`.
> Não edite manualmente — re-execute `node /tmp/doc_actions.mjs > supabase/functions/db-query/ACTIONS.md`.

Total de actions: **117**

## Índice

- [`select`](#select)
- [`insert`](#insert)
- [`update`](#update)
- [`delete`](#delete)
- [`raw`](#raw)
- [`login`](#login)
- [`change_password`](#change-password)
- [`get_client`](#get-client)
- [`update_client`](#update-client)
- [`ping`](#ping)
- [`get_external_infra_stats`](#get-external-infra-stats)
- [`get_user_agents`](#get-user-agents)
- [`get_effective_client_id`](#get-effective-client-id)
- [`create_vw_equipe`](#create-vw-equipe)
- [`get_team_by_client`](#get-team-by-client)
- [`get_agents_list`](#get-agents-list)
- [`search_clients`](#search-clients)
- [`search_users`](#search-users)
- [`search_agents`](#search-agents)
- [`get_next_agent_code`](#get-next-agent-code)
- [`get_plans`](#get-plans)
- [`insert_client`](#insert-client)
- [`check_federal_id_exists`](#check-federal-id-exists)
- [`check_user_email_exists`](#check-user-email-exists)
- [`check_agent_code_exists`](#check-agent-code-exists)
- [`insert_user`](#insert-user)
- [`insert_agent`](#insert-agent)
- [`insert_user_agent`](#insert-user-agent)
- [`delete_agent`](#delete-agent)
- [`delete_user`](#delete-user)
- [`delete_client`](#delete-client)
- [`check_user_has_agents`](#check-user-has-agents)
- [`check_client_has_agents`](#check-client-has-agents)
- [`get_team_for_agent`](#get-team-for-agent)
- [`get_agent_details`](#get-agent-details)
- [`update_agent`](#update-agent)
- [`reset_user_password`](#reset-user-password)
- [`normalize_agents_settings`](#normalize-agents-settings)
- [`diagnose_agents_settings`](#diagnose-agents-settings)
- [`diagnose_latest_agents_settings`](#diagnose-latest-agents-settings)
- [`diagnose_db_identity`](#diagnose-db-identity)
- [`update_agent_connection`](#update-agent-connection)
- [`get_crm_agents_for_user`](#get-crm-agents-for-user)
- [`get_team_members`](#get-team-members)
- [`get_principal_users`](#get-principal-users)
- [`get_user_agents_for_principal`](#get-user-agents-for-principal)
- [`get_team_member_agents`](#get-team-member-agents)
- [`insert_team_member`](#insert-team-member)
- [`update_team_member`](#update-team-member)
- [`delete_team_member`](#delete-team-member)
- [`reset_team_member_password`](#reset-team-member-password)
- [`init_permission_system`](#init-permission-system)
- [`get_user_permissions`](#get-user-permissions)
- [`get_modules`](#get-modules)
- [`get_menu_modules`](#get-menu-modules)
- [`create_module`](#create-module)
- [`ensure_adv_module`](#ensure-adv-module)
- [`update_module`](#update-module)
- [`delete_module`](#delete-module)
- [`migrate_modules_schema`](#migrate-modules-schema)
- [`get_role_default_permissions`](#get-role-default-permissions)
- [`update_user_permissions`](#update-user-permissions)
- [`update_role_default_permissions`](#update-role-default-permissions)
- [`sync_role_permissions`](#sync-role-permissions)
- [`get_users_with_permissions`](#get-users-with-permissions)
- [`check_permission`](#check-permission)
- [`update_user_profile`](#update-user-profile)
- [`get_session_status`](#get-session-status)
- [`update_session_status`](#update-session-status)
- [`get_session_statuses_batch`](#get-session-statuses-batch)
- [`chat_bootstrap`](#chat-bootstrap)
- [`advbox_get_integration`](#advbox-get-integration)
- [`advbox_save_integration`](#advbox-save-integration)
- [`advbox_update_connection_status`](#advbox-update-connection-status)
- [`advbox_delete_integration`](#advbox-delete-integration)
- [`advbox_get_rules`](#advbox-get-rules)
- [`advbox_save_rule`](#advbox-save-rule)
- [`advbox_toggle_rule`](#advbox-toggle-rule)
- [`advbox_delete_rule`](#advbox-delete-rule)
- [`advbox_get_processes`](#advbox-get-processes)
- [`advbox_upsert_process`](#advbox-upsert-process)
- [`advbox_get_notification_logs`](#advbox-get-notification-logs)
- [`advbox_save_notification_log`](#advbox-save-notification-log)
- [`advbox_update_notification_status`](#advbox-update-notification-status)
- [`advbox_get_client_queries`](#advbox-get-client-queries)
- [`advbox_save_client_query`](#advbox-save-client-query)
- [`advbox_get_lead_syncs`](#advbox-get-lead-syncs)
- [`advbox_save_lead_sync`](#advbox-save-lead-sync)
- [`advbox_update_lead_sync`](#advbox-update-lead-sync)
- [`advbox_search_processes_by_phone`](#advbox-search-processes-by-phone)
- [`get_available_agents_for_user`](#get-available-agents-for-user)
- [`delete_user_agent`](#delete-user-agent)
- [`update_user_agent_ownership`](#update-user-agent-ownership)
- [`update_user_agent_permissions`](#update-user-agent-permissions)
- [`update_agent_by_owner`](#update-agent-by-owner)
- [`migrate_user_agents_permissions`](#migrate-user-agents-permissions)
- [`update_agent_waba_connection`](#update-agent-waba-connection)
- [`clear_agent_waba_connection`](#clear-agent-waba-connection)
- [`get_agent_waba_status`](#get-agent-waba-status)
- [`get_agent_by_cod`](#get-agent-by-cod)
- [`get_inactive_sessions`](#get-inactive-sessions)
- [`create_manual_session`](#create-manual-session)
- [`get_agent_queue_settings`](#get-agent-queue-settings)
- [`init_queue_access_system`](#init-queue-access-system)
- [`get_user_queue_access`](#get-user-queue-access)
- [`list_queue_members`](#list-queue-members)
- [`set_queue_members`](#set-queue-members)
- [`set_user_queues`](#set-user-queues)
- [`list_assignable_users`](#list-assignable-users)
- [`list_users_for_queue`](#list-users-for-queue)
- [`init_embed_system`](#init-embed-system)
- [`list_module_embeds`](#list-module-embeds)
- [`upsert_module_embed`](#upsert-module-embed)
- [`delete_module_embed`](#delete-module-embed)
- [`followup_stop`](#followup-stop)
- [`agent_and_followup_reactive`](#agent-and-followup-reactive)
- [`resolve_module_embed`](#resolve-module-embed)

---

## select

Linhas: `272-302`

**Payload (`data`):**
- _nenhum campo lido de `data`_

**Retorno (`result`):**
- `await sql.unsafe(query, params)`

## insert

Linhas: `303-334`

**Payload (`data`):**
- `settings`

**Retorno (`result`):**
- `await sql.unsafe(query, valuesArr)`
- `await sql.unsafe(query, values)`

## update

Linhas: `335-380`

**Payload (`data`):**
- `settings`

**Retorno (`result`):**
- `await sql.unsafe(query, [...dataValues, ...whereValues])`
- `await sql.unsafe(query, [...dataValues, ...whereValues])`

## delete

Linhas: `381-390`

**Payload (`data`):**
- _nenhum campo lido de `data`_

**Retorno (`result`):**
- `await sql.unsafe(query, values)`

## raw

Linhas: `391-397`

**Payload (`data`):**
- `params`
- `query`

**Retorno (`result`):**
- `await sql.unsafe(query, params || [])`

## login

Linhas: `398-443`

**Payload (`data`):**
- `email`
- `password`

**Retorno (`result`):**
- `[]`
- `[]`
- `[user]`

## change_password

Linhas: `444-483`

**Payload (`data`):**
- `currentPassword`
- `newPassword`
- `userId`

**Retorno (`result`):**
- `[{ success: true }]`

## get_client

Linhas: `484-499`

**Payload (`data`):**
- `clientId`

**Retorno (`result`):**
- `clients`

## update_client

Linhas: `500-532`

**Payload (`data`):**
- `clientData`
- `clientId`

**Retorno (`result`):**
- `await sql.unsafe(query, values)`

## ping

Linhas: `533-539`

**Payload (`data`):**
- _nenhum campo lido de `data`_

**Retorno (`result`):**
- `await sql`SELECT 1 as ok, now() as server_time``

## get_external_infra_stats

Linhas: `540-559`

**Payload (`data`):**
- _nenhum campo lido de `data`_

**Retorno (`result`):**
- `rows as unknown as Record<string, unknown>[]`

## get_user_agents

Linhas: `560-602`

**Payload (`data`):**
- `userId`

**Retorno (`result`):**
- `await sql.unsafe( `SELECT ua.agent_id, ua.cod_agent::text as cod_agent, a.id as agent_id_from_agents, a.status, a.hub, …`

## get_effective_client_id

Linhas: `603-619`

**Payload (`data`):**
- `userId`

**Retorno (`result`):**
- `await sql.unsafe( `SELECT COALESCE( u.client_id, parent.client_id, (SELECT a.client_id FROM user_agents ua JOIN agents a ON a.id = ua.agent_id WHERE…`

## create_vw_equipe

Linhas: `620-640`

**Payload (`data`):**
- _nenhum campo lido de `data`_

**Retorno (`result`):**
- `[{ success: true, message: 'vw_equipe created/updated' }]`

## get_team_by_client

Linhas: `641-687`

**Payload (`data`):**
- `role`
- `userId`

**Retorno (`result`):**
- `await sql.unsafe( `SELECT v.id, v.name, v.email, v.role, v.client_id::text AS client_id, v.photo, u.user_id, u.created_at, u.remember_token, …`
- `await sql.unsafe( `SELECT v.id, v.name, v.email, v.role, v.client_id::text AS client_id, v.photo, u.user_id, u.created_at, u.remember_token, …`
- `[]`

## get_agents_list

Linhas: `688-728`

**Payload (`data`):**
- `showAll`
- `showLegacy`

**Retorno (`result`):**
- `await sql.unsafe(` SELECT a.id, a.cod_agent, a.status, a.settings, c.name AS client_name, c.business_name, …`

## search_clients

Linhas: `729-744`

**Payload (`data`):**
- `term`

**Retorno (`result`):**
- `await sql.unsafe( `SELECT id, name, business_name, email, phone FROM clients WHERE LOWER(name) LIKE $1 OR LOWER(business_name) LIKE $1 OR …`

## search_users

Linhas: `745-758`

**Payload (`data`):**
- `term`

**Retorno (`result`):**
- `await sql.unsafe( `SELECT id, name, email, role FROM users WHERE LOWER(name) LIKE $1 OR LOWER(email) LIKE $1 ORDER BY name ASC LIMIT 20`, …`

## search_agents

Linhas: `759-782`

**Payload (`data`):**
- `term`

**Retorno (`result`):**
- `await sql.unsafe( `SELECT a.id, a.cod_agent::text as cod_agent, c.name AS client_name, c.business_name FROM agents a …`

## get_next_agent_code

Linhas: `783-803`

**Payload (`data`):**
- _nenhum campo lido de `data`_

**Retorno (`result`):**
- `[{ cod_agent: `${prefix}${nextSeq}` }]`

## get_plans

Linhas: `804-813`

**Payload (`data`):**
- _nenhum campo lido de `data`_

**Retorno (`result`):**
- `await sql.unsafe( `SELECT id, name, "limit" as leads_limit, 0 as price FROM agents_plan WHERE satus = true ORDER BY "limit" ASC` )`

## insert_client

Linhas: `814-828`

**Payload (`data`):**
- `clientData`

**Retorno (`result`):**
- `await sql.unsafe( `INSERT INTO clients (${columns}, created_at, updated_at) VALUES (${placeholders}, now(), now()) RETURNING *`, values )`

## check_federal_id_exists

Linhas: `829-838`

**Payload (`data`):**
- `federalId`

**Retorno (`result`):**
- `[{ exists: rows.length > 0, clientId: rows.length > 0 ? rows[0].id : null }]`

## check_user_email_exists

Linhas: `839-848`

**Payload (`data`):**
- `email`

**Retorno (`result`):**
- `[{ exists: rows.length > 0, userId: rows.length > 0 ? rows[0].id : null }]`

## check_agent_code_exists

Linhas: `849-863`

**Payload (`data`):**
- `codAgent`

**Retorno (`result`):**
- `[{ exists: false }]`
- `[{ exists: rows.length > 0 }]`

## insert_user

Linhas: `864-875`

**Payload (`data`):**
- `clientId`
- `email`
- `hashedPassword`
- `name`
- `rawPassword`

**Retorno (`result`):**
- `rows`

## insert_agent

Linhas: `876-896`

**Payload (`data`):**
- `agent_plan_id`
- `client_id`
- `cod_agent`
- `due_date`
- `is_closer`
- `prompt`
- `settings`
- `user_id`

**Retorno (`result`):**
- `rows`

## insert_user_agent

Linhas: `897-947`

**Payload (`data`):**
- `agentId`
- `codAgent`
- `userId`

**Retorno (`result`):**
- `rows`

## delete_agent

Linhas: `948-954`

**Payload (`data`):**
- `agentId`

**Retorno (`result`):**
- `[{ success: true }]`

## delete_user

Linhas: `955-961`

**Payload (`data`):**
- `userId`

**Retorno (`result`):**
- `[{ success: true }]`

## delete_client

Linhas: `962-968`

**Payload (`data`):**
- `clientId`

**Retorno (`result`):**
- `[{ success: true }]`

## check_user_has_agents

Linhas: `969-978`

**Payload (`data`):**
- `userId`

**Retorno (`result`):**
- `[{ hasAgents: parseInt(rows[0].count) > 0 }]`

## check_client_has_agents

Linhas: `979-988`

**Payload (`data`):**
- `clientId`

**Retorno (`result`):**
- `[{ hasAgents: parseInt(rows[0].count) > 0 }]`

## get_team_for_agent

Linhas: `989-1012`

**Payload (`data`):**
- `codAgent`

**Retorno (`result`):**
- `[]`
- `members`

## get_agent_details

Linhas: `1013-1073`

**Payload (`data`):**
- `agentId`

**Retorno (`result`):**
- `rows`

## update_agent

Linhas: `1074-1109`

**Payload (`data`):**
- `agentData`
- `agentId`

**Retorno (`result`):**
- `rows.map((row) => { const r = row as Record<string, unknown>`

## reset_user_password

Linhas: `1110-1123`

**Payload (`data`):**
- `hashedPassword`
- `rawPassword`
- `userId`

**Retorno (`result`):**
- `rows`

## normalize_agents_settings

Linhas: `1124-1170`

**Payload (`data`):**
- _nenhum campo lido de `data`_

**Retorno (`result`):**
- `[{ pre_check: preCheck, fixed_count: stringCount, fixed_ids_sample: fixedIds, post_check: postCheck }]`

## diagnose_agents_settings

Linhas: `1171-1182`

**Payload (`data`):**
- _nenhum campo lido de `data`_

**Retorno (`result`):**
- `diagnosis`

## diagnose_latest_agents_settings

Linhas: `1183-1200`

**Payload (`data`):**
- _nenhum campo lido de `data`_

**Retorno (`result`):**
- `diagnosis`

## diagnose_db_identity

Linhas: `1201-1215`

**Payload (`data`):**
- _nenhum campo lido de `data`_

**Retorno (`result`):**
- `diagnosis`

## update_agent_connection

Linhas: `1216-1229`

**Payload (`data`):**
- `agentId`
- `connectionData`

**Retorno (`result`):**
- `[{ success: true }]`

## get_crm_agents_for_user

Linhas: `1230-1249`

**Payload (`data`):**
- `userId`

**Retorno (`result`):**
- `await sql.unsafe( `SELECT DISTINCT COALESCE(ua.cod_agent::text, a.cod_agent::text) as cod_agent, c.name as owner_name, c.business_name as owner_business_…`

## get_team_members

Linhas: `1250-1284`

**Payload (`data`):**
- `isAdmin`
- `userId`

**Retorno (`result`):**
- `await sql.unsafe( `SELECT u.id, u.name, u.email, u.user_id, u.created_at, u.remember_token, c.photo, COUNT(ua.id)::int as agents_count …`
- `await sql.unsafe( `SELECT u.id, u.name, u.email, u.user_id, u.created_at, u.remember_token, c.photo, COUNT(ua.id)::int as agents_count …`

## get_principal_users

Linhas: `1285-1307`

**Payload (`data`):**
- `isAdmin`
- `userId`

**Retorno (`result`):**
- `await sql.unsafe( `SELECT id, name, email, role FROM users WHERE role IN ('admin', 'user') ORDER BY name` )`
- `await sql.unsafe( `SELECT id, name, email, role FROM users WHERE id = $1 ORDER BY name`, [userId] )`

## get_user_agents_for_principal

Linhas: `1308-1329`

**Payload (`data`):**
- `principalUserId`

**Retorno (`result`):**
- `await sql.unsafe( `SELECT ua.agent_id, ua.cod_agent::text as cod_agent, COALESCE(a.status, true) as status, COALESCE(c.business_name, 'Agente…`

## get_team_member_agents

Linhas: `1330-1340`

**Payload (`data`):**
- `memberId`

**Retorno (`result`):**
- `await sql.unsafe( `SELECT ua.agent_id, ua.cod_agent::text as cod_agent FROM user_agents ua WHERE ua.user_id = $1`, [memberId] )`

## insert_team_member

Linhas: `1341-1384`

**Payload (`data`):**
- `agentIds`
- `clientId`
- `email`
- `hashedPassword`
- `modulePermissions`
- `name`
- `principalUserId`
- `rawPassword`
- `role`

**Retorno (`result`):**
- `userRows`

## update_team_member

Linhas: `1385-1433`

**Payload (`data`):**
- `agentIds`
- `memberId`
- `modulePermissions`
- `name`
- `principalUserId`
- `role`

**Retorno (`result`):**
- `[{ success: true }]`

## delete_team_member

Linhas: `1434-1478`

**Payload (`data`):**
- `memberId`

**Retorno (`result`):**
- `[{ success: false, reason: 'not_found_or_role_not_allowed', message: 'Usuário não encontrado ou com cargo que não permite remoção por este fluxo.', …`
- `[{ success: true }]`
- `[{ success: false, reason: 'fk_violation', message: 'Não foi possível remover: o usuário possui registros vinculados.', detail: msg, …`

## reset_team_member_password

Linhas: `1479-1495`

**Payload (`data`):**
- `hashedPassword`
- `memberId`
- `rawPassword`

**Retorno (`result`):**
- `[{ success: true }]`

## init_permission_system

Linhas: `1496-1687`

**Payload (`data`):**
- _nenhum campo lido de `data`_

**Retorno (`result`):**
- `[{ success: true, message: 'Permission system initialized' }]`

## get_user_permissions

Linhas: `1688-1814`

**Payload (`data`):**
- `userId`

**Retorno (`result`):**
- `[]`
- `await sql.unsafe(` SELECT m.code as module_code, m.name as module_name, m.category, TRUE as can_view, TRUE as can_create, TRUE as can_edit, TRUE as can_delete …`
- `await sql.unsafe(` SELECT m.code as module_code, m.name as module_name, m.category, COALESCE(up.can_view, FALSE) as can_view, COALESCE(up.can_create, …`
- `await sql.unsafe(` SELECT m.code as module_code, m.name as module_name, m.category, COALESCE(rdp.can_view, FALSE) as can_view, COALESCE(rdp.can_create…`
- `result.map(perm => { const parent = parentMap.get(perm.module_code)`

## get_modules

Linhas: `1815-1841`

**Payload (`data`):**
- _nenhum campo lido de `data`_

**Retorno (`result`):**
- `await sql.unsafe(` SELECT id, code, name, description, category, is_active, display_order, icon, route, parent_module_id, menu_group, is_menu_visible FROM mo…`
- `await sql.unsafe(` SELECT id, code, name, description, category, is_active, display_order, NULL as icon, NULL as route, NULL as parent_module_id, cat…`

## get_menu_modules

Linhas: `1842-1873`

**Payload (`data`):**
- _nenhum campo lido de `data`_

**Retorno (`result`):**
- `await sql.unsafe(` SELECT id, code, name, category, display_order, icon, route, parent_module_id, menu_group, is_menu_visible, COALESCE(module_type, '…`
- `await sql.unsafe(` SELECT id, code, name, category, display_order, NULL as icon, NULL as route, NULL as parent_module_id, category as menu_group, TRU…`

## create_module

Linhas: `1874-1903`

**Payload (`data`):**
- `moduleData`

**Retorno (`result`):**
- `inserted`

## ensure_adv_module

Linhas: `1904-1942`

**Payload (`data`):**
- _nenhum campo lido de `data`_

**Retorno (`result`):**
- `[{ success: true, module_id: advModuleId }]`

## update_module

Linhas: `1943-1975`

**Payload (`data`):**
- `moduleData`
- `moduleId`

**Retorno (`result`):**
- `await sql.unsafe(`SELECT * FROM modules WHERE id = $1`, [moduleId])`
- `await sql.unsafe( `UPDATE modules SET ${setClauses}, updated_at = now() WHERE id = $${values.length} RETURNING *`, values )`

## delete_module

Linhas: `1976-1986`

**Payload (`data`):**
- `moduleId`

**Retorno (`result`):**
- `await sql.unsafe( `UPDATE modules SET is_active = FALSE, updated_at = now() WHERE id = $1 RETURNING *`, [moduleId] )`

## migrate_modules_schema

Linhas: `1987-2053`

**Payload (`data`):**
- _nenhum campo lido de `data`_

**Retorno (`result`):**
- `[{ success: true, message: 'Schema migrated and modules updated' }]`

## get_role_default_permissions

Linhas: `2054-2071`

**Payload (`data`):**
- `role`

**Retorno (`result`):**
- `await sql.unsafe(` SELECT m.code as module_code, m.name as module_name, m.category, COALESCE(rdp.can_view, FALSE) as can_view, COALESCE(rdp.can_create, FAL…`

## update_user_permissions

Linhas: `2072-2108`

**Payload (`data`):**
- `permissions`
- `useCustom`
- `userId`

**Retorno (`result`):**
- `[{ success: true }]`

## update_role_default_permissions

Linhas: `2109-2137`

**Payload (`data`):**
- `permissions`
- `role`

**Retorno (`result`):**
- `[{ success: true }]`

## sync_role_permissions

Linhas: `2138-2157`

**Payload (`data`):**
- _nenhum campo lido de `data`_

**Retorno (`result`):**
- `[{ success: true, message: 'Permissões sincronizadas com sucesso' }]`

## get_users_with_permissions

Linhas: `2158-2180`

**Payload (`data`):**
- `roleFilter`

**Retorno (`result`):**
- `await sql.unsafe(query, params)`

## check_permission

Linhas: `2181-2193`

**Payload (`data`):**
- `moduleCode`
- `permissionType`
- `userId`

**Retorno (`result`):**
- `checkResult`

## update_user_profile

Linhas: `2194-2211`

**Payload (`data`):**
- `email`
- `isActive`
- `name`
- `role`
- `userId`

**Retorno (`result`):**
- `rows`

## get_session_status

Linhas: `2212-2248`

**Payload (`data`):**
- `codAgent`
- `whatsappNumber`

**Retorno (`result`):**
- `rows`

## update_session_status

Linhas: `2249-2262`

**Payload (`data`):**
- `active`
- `sessionId`

**Retorno (`result`):**
- `[{ success: true }]`

## get_session_statuses_batch

Linhas: `2263-2304`

**Payload (`data`):**
- `pairs`

**Retorno (`result`):**
- `[]`
- `rows`

## chat_bootstrap

Linhas: `2305-2415`

**Payload (`data`):**
- `campaignPhoneVariants`
- `crmPhoneVariants`
- `sessionPairs`

**Retorno (`result`):**
- `{ campaigns, crmStages, sessions }`

## advbox_get_integration

Linhas: `2416-2434`

**Payload (`data`):**
- `agentId`

**Retorno (`result`):**
- `rows`

## advbox_save_integration

Linhas: `2435-2456`

**Payload (`data`):**
- `agentId`
- `apiEndpoint`
- `apiToken`
- `connectionStatus`
- `isActive`
- `lastError`
- `settings`

**Retorno (`result`):**
- `rows`

## advbox_update_connection_status

Linhas: `2457-2476`

**Payload (`data`):**
- `agentId`
- `connectionStatus`
- `lastError`
- `lastSyncAt`

**Retorno (`result`):**
- `rows`

## advbox_delete_integration

Linhas: `2477-2488`

**Payload (`data`):**
- `integrationId`

**Retorno (`result`):**
- `[{ success: true }]`

## advbox_get_rules

Linhas: `2489-2517`

**Payload (`data`):**
- `agentId`
- `integrationId`

**Retorno (`result`):**
- `await sql.unsafe(query, params)`

## advbox_save_rule

Linhas: `2518-2552`

**Payload (`data`):**
- `agentId`
- `cooldownMinutes`
- `eventTypes`
- `id`
- `integrationId`
- `isActive`
- `keywords`
- `messageTemplate`
- `processPhases`
- `ruleName`
- `sendTo`

**Retorno (`result`):**
- `rows`
- `rows`

## advbox_toggle_rule

Linhas: `2553-2564`

**Payload (`data`):**
- `isActive`
- `ruleId`

**Retorno (`result`):**
- `rows`

## advbox_delete_rule

Linhas: `2565-2576`

**Payload (`data`):**
- `ruleId`

**Retorno (`result`):**
- `[{ success: true }]`

## advbox_get_processes

Linhas: `2577-2611`

**Payload (`data`):**
- `agentId`
- `limit`
- `offset`
- `phase`
- `search`

**Retorno (`result`):**
- `await sql.unsafe(query, params)`

## advbox_upsert_process

Linhas: `2612-2639`

**Payload (`data`):**
- `agentId`
- `clientId`
- `clientName`
- `clientPhone`
- `fullData`
- `integrationId`
- `lastMovementDate`
- `lastMovementId`
- `lastMovementText`
- `phase`
- `processId`
- `processNumber`
- `responsible`
- `status`

**Retorno (`result`):**
- `rows`

## advbox_get_notification_logs

Linhas: `2640-2679`

**Payload (`data`):**
- `agentId`
- `limit`
- `offset`
- `ruleId`
- `status`

**Retorno (`result`):**
- `await sql.unsafe(query, params)`

## advbox_save_notification_log

Linhas: `2680-2693`

**Payload (`data`):**
- `agentId`
- `errorMessage`
- `integrationId`
- `messageText`
- `processId`
- `recipientPhone`
- `ruleId`
- `sentAt`
- `status`
- `whatsappMessageId`
- `whatsappResponse`

**Retorno (`result`):**
- `rows`

## advbox_update_notification_status

Linhas: `2694-2712`

**Payload (`data`):**
- `errorMessage`
- `logId`
- `sentAt`
- `status`
- `whatsappMessageId`
- `whatsappResponse`

**Retorno (`result`):**
- `rows`

## advbox_get_client_queries

Linhas: `2713-2737`

**Payload (`data`):**
- `agentId`
- `limit`
- `offset`

**Retorno (`result`):**
- `await sql.unsafe(query, params)`

## advbox_save_client_query

Linhas: `2738-2751`

**Payload (`data`):**
- `agentId`
- `clientName`
- `clientPhone`
- `foundProcesses`
- `integrationId`
- `queryText`
- `queryTimeMs`
- `queryType`
- `responseSent`
- `responseText`

**Retorno (`result`):**
- `rows`

## advbox_get_lead_syncs

Linhas: `2752-2782`

**Payload (`data`):**
- `agentId`
- `limit`
- `offset`
- `status`

**Retorno (`result`):**
- `await sql.unsafe(query, params)`

## advbox_save_lead_sync

Linhas: `2783-2796`

**Payload (`data`):**
- `advboxClientId`
- `advboxResponse`
- `agentId`
- `errorMessage`
- `fullLeadData`
- `integrationId`
- `leadEmail`
- `leadName`
- `leadNotes`
- `leadSource`
- `retryCount`
- `syncStatus`
- `syncedAt`
- `whatsappNumber`

**Retorno (`result`):**
- `rows`

## advbox_update_lead_sync

Linhas: `2797-2817`

**Payload (`data`):**
- `advboxClientId`
- `advboxResponse`
- `errorMessage`
- `leadSyncId`
- `retryCount`
- `syncStatus`
- `syncedAt`

**Retorno (`result`):**
- `rows`

## advbox_search_processes_by_phone

Linhas: `2818-2836`

**Payload (`data`):**
- `agentId`
- `clientPhone`

**Retorno (`result`):**
- `rows`

## get_available_agents_for_user

Linhas: `2837-2853`

**Payload (`data`):**
- `userId`

**Retorno (`result`):**
- `await sql.unsafe( `SELECT a.id, a.cod_agent::text as cod_agent, c.name AS client_name, c.business_name FROM agents a JOIN clients c ON c.id = a.client_id WHE…`

## delete_user_agent

Linhas: `2854-2863`

**Payload (`data`):**
- `codAgent`
- `userId`

**Retorno (`result`):**
- `[{ success: true }]`

## update_user_agent_ownership

Linhas: `2864-2889`

**Payload (`data`):**
- `agentId`
- `codAgent`
- `userId`

**Retorno (`result`):**
- `[{ success: true }]`

## update_user_agent_permissions

Linhas: `2890-2899`

**Payload (`data`):**
- `canEditConfig`
- `canEditPrompt`
- `codAgent`
- `userId`

**Retorno (`result`):**
- `[{ success: true }]`

## update_agent_by_owner

Linhas: `2900-2940`

**Payload (`data`):**
- `codAgent`
- `prompt`
- `settings`
- `userId`

**Retorno (`result`):**
- `rows`

## migrate_user_agents_permissions

Linhas: `2941-2950`

**Payload (`data`):**
- _nenhum campo lido de `data`_

**Retorno (`result`):**
- `[{ success: true, message: 'Columns added successfully' }]`

## update_agent_waba_connection

Linhas: `2951-2968`

**Payload (`data`):**
- `agentId`
- `wabaId`
- `wabaNumberId`
- `wabaToken`

**Retorno (`result`):**
- `await sql.unsafe( `UPDATE agents SET hub = 'waba', waba_id = $1, waba_token = $2, waba_number_id = $3, updated_at …`

## clear_agent_waba_connection

Linhas: `2969-2984`

**Payload (`data`):**
- `agentId`

**Retorno (`result`):**
- `await sql.unsafe( `UPDATE agents SET hub = NULL, waba_id = NULL, waba_token = NULL, waba_number_id = NULL, updated…`

## get_agent_waba_status

Linhas: `2985-2996`

**Payload (`data`):**
- `agentId`

**Retorno (`result`):**
- `await sql.unsafe( `SELECT id, hub, waba_id, waba_token, waba_number_id, CASE WHEN waba_id IS NOT NULL AND waba_token IS NOT NULL AND waba_number_id IS NOT NULL THEN true EL…`

## get_agent_by_cod

Linhas: `2997-3007`

**Payload (`data`):**
- `codAgent`

**Retorno (`result`):**
- `await sql.unsafe( `SELECT id, cod_agent, hub, evo_url, evo_apikey, evo_instance, waba_id, waba_token, waba_number_id FROM agents WHERE cod_agent::text = $1::text LIMIT 1`, …`

## get_inactive_sessions

Linhas: `3008-3041`

**Payload (`data`):**
- `agentCodes`

**Retorno (`result`):**
- `rows`

## create_manual_session

Linhas: `3042-3068`

**Payload (`data`):**
- `codAgent`
- `whatsappNumber`

**Retorno (`result`):**
- `[{ success: true }]`

## get_agent_queue_settings

Linhas: `3069-3097`

**Payload (`data`):**
- `client_id`
- `cod_agent`

**Retorno (`result`):**
- `[{ queue_limit: queueLimit, allow_groups: allowGroups }]`

## init_queue_access_system

Linhas: `3098-3141`

**Payload (`data`):**
- _nenhum campo lido de `data`_

**Retorno (`result`):**
- `[{ initialized: true }]`

## get_user_queue_access

Linhas: `3142-3155`

**Payload (`data`):**
- `user_id`

**Retorno (`result`):**
- `[{ queue_access: 'all', queue_ids: [] }]`
- `[{ queue_access: 'specific', queue_ids: rows.map((r: any) => r.queue_id) }]`

## list_queue_members

Linhas: `3156-3168`

**Payload (`data`):**
- `queue_id`

**Retorno (`result`):**
- `await sql.unsafe(` SELECT qm.user_id, qm.role, u.name, u.email, u.role as user_role FROM queue_members qm INNER JOIN users u ON u.id = qm.user_id WHERE qm.queue…`

## set_queue_members

Linhas: `3169-3184`

**Payload (`data`):**
- `members`
- `queue_id`

**Retorno (`result`):**
- `[{ ok: true, count: members.length }]`

## set_user_queues

Linhas: `3185-3206`

**Payload (`data`):**
- `queue_access`
- `queue_ids`
- `role`
- `user_id`

**Retorno (`result`):**
- `[{ ok: true }]`

## list_assignable_users

Linhas: `3207-3220`

**Payload (`data`):**
- `client_id`

**Retorno (`result`):**
- `await sql.unsafe(` SELECT id, name, email, role, COALESCE(queue_access, 'all') as queue_access FROM users WHERE client_id = $1 AND COALESCE(is_active, TRUE) = TRUE …`

## list_users_for_queue

Linhas: `3221-3237`

**Payload (`data`):**
- `client_id`
- `queue_id`

**Retorno (`result`):**
- `await sql.unsafe(` SELECT id FROM users WHERE client_id = $1 AND COALESCE(is_active, TRUE) = TRUE AND ( COALESCE(queue_access, 'all') = 'all' OR id IN (SELECT user_id…`

## init_embed_system

Linhas: `3238-3290`

**Payload (`data`):**
- _nenhum campo lido de `data`_

**Retorno (`result`):**
- `[{ initialized: true }]`

## list_module_embeds

Linhas: `3291-3324`

**Payload (`data`):**
- _nenhum campo lido de `data`_

**Retorno (`result`):**
- `[]`
- `await sql.unsafe(` SELECT m.id, m.code, m.name, m.icon, m.menu_group, m.display_order, m.is_menu_visible, m.is_active, m.module_type, e.url_template, …`

## upsert_module_embed

Linhas: `3325-3396`

**Payload (`data`):**
- `embed`

**Retorno (`result`):**
- `[{ module_id: moduleId, ok: true }]`

## delete_module_embed

Linhas: `3397-3405`

**Payload (`data`):**
- `module_id`

**Retorno (`result`):**
- `[{ ok: true }]`

## followup_stop

Linhas: `3406-3447`

**Payload (`data`):**
- `codAgent`
- `phones`

**Retorno (`result`):**
- `[{ deleted_temp: (deletedTemp as any)?.count ?? 0, updated_queue: (updatedQueue as any)?.count ?? 0, deleted_status: (deletedStatus as any)?.count ?? 0, phones,…`

## agent_and_followup_reactive

Linhas: `3448-3526`

**Payload (`data`):**
- `codAgent`
- `hubFila`
- `phones`
- `whatsappNumberInsert`

**Retorno (`result`):**
- `[txResult]`

## resolve_module_embed

Linhas: `3527-3626`

**Payload (`data`):**
- `module_code`
- `user_id`

**Retorno (`result`):**
- `[{ url: finalUrl, open_in_new_tab: !!emb.open_in_new_tab, iframe_sandbox: emb.iframe_sandbox || 'allow-scripts allow-forms allow-same-origin', iframe_referrer_p…`
