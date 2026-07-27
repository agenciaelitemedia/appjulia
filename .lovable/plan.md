
# Permissionamento por Board no CRM Builder

Cada board terá uma aba **Permissões** (dentro do botão Configurações) onde o **dono do client_id** define, por usuário ou por perfil, quem pode:

- **Ver** o board e seus cards
- **Criar** novos cards
- **Editar** cards existentes
- **Remover** cards

Sem regra configurada, valem os defaults atuais (admin/user/colaborador gerenciam, demais só leitura).

## Quem é o "dono"

O dono do client_id é o usuário cujo `id === client_id` (titular da conta) OU qualquer usuário com `role = 'admin'`. Somente esses veem a aba Permissões e podem gravar. Membros de equipe (time/advogado/comercial) e `colaborador` **não** editam permissões, apenas as recebem.

## Modelo de dados (Supabase)

Nova tabela `public.crm_board_permissions`:

| coluna | tipo | descrição |
|---|---|---|
| id | uuid PK | |
| board_id | uuid | FK lógica p/ `crm_boards.id` |
| client_id | text | escopo do tenant (index) |
| subject_type | text | `'user'` ou `'role'` |
| subject_id | text | id do usuário (bigint em texto) ou nome do perfil (`user`, `time`, `advogado`, `comercial`, `colaborador`) |
| can_view / can_create / can_edit / can_delete | boolean default false | |
| created_at / updated_at | timestamptz | |
| created_by | text (cod_agent) | |

Constraints: `UNIQUE (board_id, subject_type, subject_id)`.

RLS: policies permissivas (padrão do módulo) — enforcement de escrita é feita na aplicação (dono/admin apenas), coerente com o restante do CRM Builder. GRANT para authenticated e service_role.

Auditoria: cada mudança gera linha em `crm_audit_log` com `entity_type = 'permission'` via `logCRMAudit`.

## Resolução de permissão efetiva

Novo hook `useBoardPermission(boardId)` retorna `{ canView, canCreate, canEdit, canDelete, isOwner }`:

1. Se `isOwner` (id===client_id) ou `role==='admin'` → tudo `true`.
2. Buscar regras do board no cache (React Query, key `['crm-board-permissions', boardId]`).
3. Aplicar merge OR na ordem: default por role → regra por role do usuário → regra por usuário específico. A regra mais específica que existir sobrescreve; flags não definidas caem no nível anterior.
4. Se não há nenhuma regra e o usuário não é `admin/user/colaborador`, mantém o comportamento atual (só leitura da view do board se `canView` implícito).

Fallback compatível: se a tabela estiver vazia para o board, mantém exatamente o comportamento atual (nada quebra).

## Frontend

- `BoardSettingsSheet`: adicionar aba **Permissões** (ícone `ShieldCheck`), renderizada apenas quando `isOwner || role==='admin'`. Ajustar `tabsCount` dinamicamente.
- Novo componente `PermissionsManager` dentro de `components/settings/permissions/`:
  - Sub-aba "Por perfil": tabela com 5 linhas (user, colaborador, time, advogado, comercial) x 4 checkboxes.
  - Sub-aba "Por usuário": autocomplete de usuários do mesmo `client_id` (via `externalDb.listClientUsers` já usado em Equipe) → adiciona linha com 4 checkboxes; botão remover.
  - Salvamento com debounce (500ms) por linha; toast de confirmação.
- Novo hook `useCRMBoardPermissions(boardId, clientId)` com fetch, upsert e delete + realtime channel `crm-board-permissions-${clientId}-${boardId}`.
- Aplicar `useBoardPermission` em:
  - `BoardPage` (redireciona se `!canView`).
  - `DealCard`/`PipelineColumn`: esconde botão "Novo card" quando `!canCreate`; desabilita drag/edição quando `!canEdit`; esconde menu delete quando `!canDelete`.
  - `useCRMDeals` mutations: guarda-de-servidor extra (early return + toast) para create/update/delete.

## Detalhes técnicos

- Nomes de canais realtime seguem o padrão do memory `crm-builder-client-scope` (isolamento por clientId).
- `logCRMAudit` com `entity_type: 'permission'`, `entity_id: <subject_type>:<subject_id>`, `action: created|updated|deleted`, `changes: { before, after }`.
- Migração cria índices em `(board_id)` e `(client_id, subject_type, subject_id)`.
- Nenhuma mudança em `crm_boards`, `crm_pipelines`, `crm_deals` — apenas leitura de flags no client.

## Entrega

1. Migration Supabase: tabela + grants + RLS + triggers de updated_at.
2. Hook `useCRMBoardPermissions` + `useBoardPermission`.
3. Componente `PermissionsManager` + integração na aba do `BoardSettingsSheet`.
4. Enforcement nos pontos de create/edit/delete de deals e no gate de view do board.
5. Memory update em `mem/features/crm/builder-client-scope.md` documentando o novo layer de permissões.

## Fora do escopo

- Permissões por pipeline/estágio (só a nível de board neste ciclo).
- Compartilhar boards entre client_ids diferentes.
- UI para o dono transferir a titularidade do client.
