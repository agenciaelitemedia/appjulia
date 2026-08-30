# Enriquecer `julia_equipe_listar` com os dados do dashboard de Equipe

## Objetivo

A tool MCP `julia_equipe_listar` hoje retorna apenas nome, e-mail, papel e se está ativo. Será ampliada para espelhar todas as colunas da tela de Equipe (`/equipe`, componente `src/pages/equipe/components/EquipeDashboardTab.tsx`):

| Coluna da tela | Fonte |
|---|---|
| Status Online/Ausente/Offline + "ativo há X" | view `user_presence_status` (is_online, is_away, last_seen_at) — confirmada no banco |
| Último login | view `user_last_activity` (last_login_at) — confirmada |
| Último logout + selo Inatividade/Manual | `user_last_activity` (last_logout_at, last_logout_type) |
| Som ativo/desativado | `chat_client_settings.settings` (sound_alert_enabled, sound_alert_muted_users) |
| Chats abertos | `chat_conversations` status open/pending, por assigned_user_id ou nome |
| CRM abertos | `crm_deals` excluindo won/lost, por assigned_user_id ou nome |
| Tarefas abertas | `tasks` status pending/in_progress, por assigned_user_id ou id |

A lógica de contagem replica exatamente `src/hooks/useTeamDashboardMetrics.ts` (match por `assigned_user_id` primeiro, fallback por nome em `assigned_to`; CRM só filtra won/lost no resultado).

## Mudanças

1. **`supabase/functions/_shared/copiloto/tools/operacao.ts`** — reescrever o `run` de `julia_equipe_listar`:
   - Mantém a query de usuários no banco legado (nome, email, role, is_active).
   - Busca em paralelo: `user_presence_status` (por client_id), `user_last_activity` (por ids), `chat_client_settings` (som), e as 3 contagens (chats, deals, tasks).
   - Formata cada linha com: nome, email, papel, status de presença (Online/Ausente/Offline + tempo desde última atividade), último login, último logout (com selo Inatividade/Manual), som ativo/desativado, e contadores de chats/CRM/tarefas.
   - Datas formatadas em pt-BR no fuso de Brasília.
   - Atualiza a `description` da tool para refletir os novos campos.
2. **`src/modules/mvp-copiloto/components/ToolCatalogCard.tsx`** — atualizar descrição da tool no catálogo visual.
3. **`docs/MCP_julia.md`** — atualizar documentação da tool.

## Regras preservadas

- Tool continua somente leitura; isolamento por `client_id` mantido em todas as consultas (server-side, sem parâmetro de client do chamador).
- A query de `crm_deals` ganha filtro explícito de `client_id` (na tela a contagem depende de RLS; na edge function com service role o filtro é obrigatório para não vazar cross-tenant).
- Limite de 200 usuários e clipping de saída existentes no dispatcher permanecem.
- Sem chamada de IA interna.

## Verificação

- Reimplantar `copiloto-mcp`.
- Smoke test sem Bearer deve continuar retornando 401.
- Build OK.
