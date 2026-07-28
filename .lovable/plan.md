# Separar CRM Builder em módulo próprio (`crm_builder`)

Objetivo: desacoplar o acesso ao **Construtor de CRM** do módulo `crm_leads` (CRM da Jul.IA), criando um módulo independente `crm_builder`. Ao ligar, replicar as permissões existentes de `crm_leads` para `crm_builder`, de modo que ninguém perca acesso.

## 1. Registrar o novo módulo `crm_builder`

Criar `src/hooks/useEnsureCrmBuilderModule.ts` (padrão dos demais `useEnsure*Module`):

- Só roda para `isAdmin`.
- Busca módulos via `externalDb.getModules()`; se `crm_builder` não existe, chama `externalDb.createModule` com:
  - `code: 'crm_builder'`
  - `name: 'Construtor de CRM'`
  - `description: 'Quadros, pipelines e cards customizados'`
  - `icon: 'LayoutDashboard'`
  - `route: '/crm-builder'`
  - `menu_group: 'CRM'`
  - `is_menu_visible: true`
  - `display_order: 25`
  - `category: 'crm'`
  - `is_active: true`
- Se já existe mas com `route`/`menu_group`/`is_menu_visible` divergentes, atualiza.
- Invalida `['menu-modules']` e `['admin-modules']`.

Chamar o hook em `src/components/layout/MainLayout.tsx` junto aos outros `useEnsure*Module`.

## 2. Tornar `crm_builder` reconhecido pelos tipos

Em `src/types/permissions.ts`, adicionar `'crm_builder'` ao union `ModuleCode`. (O union já aceita string dinâmica, mas o literal explícito melhora autocomplete e cobertura.)

## 3. Trocar o gate de rota

Em `src/App.tsx` (linhas 198-200), trocar as 3 rotas do CRM Builder de `module="crm_leads"` para `module="crm_builder"`:

- `/crm-builder`
- `/crm-builder/:boardId`
- `/crm-builder/:boardId/configuracoes`

O CRM da Jul.IA (`/crm/leads`) continua em `crm_leads` — sem mudança.

## 4. Backfill: copiar permissões de `crm_leads` → `crm_builder`

Precisa rodar **uma vez**, após o módulo `crm_builder` estar cadastrado em `modules`. Duas partes:

**4a. Migração de dados (usuários com permissão custom)** — via `db-query` (Postgres externo), rodada por mim assim que o módulo for criado no ambiente. Efeito: para cada linha em `user_permissions` onde `module_id = (id de crm_leads)`, insere uma linha equivalente para `module_id = (id de crm_builder)`, preservando `can_view/can_create/can_edit/can_delete`, e ignorando se já existir.

Esboço (executado via ação `raw` do `db-query`):
```sql
INSERT INTO user_permissions (user_id, module_id, can_view, can_create, can_edit, can_delete)
SELECT up.user_id,
       (SELECT id FROM modules WHERE code = 'crm_builder'),
       up.can_view, up.can_create, up.can_edit, up.can_delete
FROM user_permissions up
JOIN modules m ON m.id = up.module_id
WHERE m.code = 'crm_leads'
ON CONFLICT (user_id, module_id) DO NOTHING;
```

**4b. Defaults por papel** — se existir tabela `role_default_permissions` (herdada por quem tem `use_custom_permissions=false`), replicar da mesma forma:
```sql
INSERT INTO role_default_permissions (role, module_id, can_view, can_create, can_edit, can_delete)
SELECT rdp.role,
       (SELECT id FROM modules WHERE code = 'crm_builder'),
       rdp.can_view, rdp.can_create, rdp.can_edit, rdp.can_delete
FROM role_default_permissions rdp
JOIN modules m ON m.id = rdp.module_id
WHERE m.code = 'crm_leads'
ON CONFLICT DO NOTHING;
```

Confirmarei o nome exato da tabela de defaults durante a execução (checar `db-query` actions) antes de rodar; se o nome for outro, ajusto a query. Sem migração de schema — só INSERT com `ON CONFLICT DO NOTHING`, então é idempotente e seguro rodar mais de uma vez.

## 5. Verificação

Depois do deploy + backfill:

1. Consulto no banco: `SELECT COUNT(*)` de `user_permissions` para `crm_leads` e para `crm_builder` — devem bater.
2. Verifico especificamente o Ivanaldo (id 376): hoje sem linha em `crm_leads` → continuará sem `crm_builder` (esperado, ele não tinha acesso antes). Para liberar, admin marca no painel de Permissões, ou eu insiro manualmente se você preferir.
3. Testo com um usuário que hoje tem `crm_leads` → deve ver o menu "Construtor de CRM" e conseguir entrar em `/crm-builder`.

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/hooks/useEnsureCrmBuilderModule.ts` | **novo** — registra o módulo |
| `src/components/layout/MainLayout.tsx` | chama o novo hook |
| `src/types/permissions.ts` | adiciona `'crm_builder'` ao `ModuleCode` |
| `src/App.tsx` | troca `module="crm_leads"` → `module="crm_builder"` nas 3 rotas do Builder |
| Banco externo (via `db-query`) | INSERTs de backfill em `user_permissions` (+ defaults de role se existir) |

## Fora do escopo

- Não altero `crm_board_permissions` (permissão fina por quadro) — segue por cima do gate de módulo.
- Não mexo em `/crm/leads` nem no gate de leitura do painel de chat dentro do card (feito na fase anterior).
- Não removo permissões de `crm_leads` de ninguém — só somo `crm_builder` a quem já tinha.

## Riscos

- Enquanto o módulo `crm_builder` não estiver cadastrado no `modules`, a rota fica inacessível para não-admin. Mitigação: o hook `useEnsureCrmBuilderModule` roda no login do admin e cadastra em segundos; o backfill vem logo depois. Admins não são afetados (bypass total).
- Se algum lugar do código ainda usar `crm_leads` para gatear UI do Builder, o menu pode não aparecer para quem só tinha `crm_leads`. Vou grepar por `'crm_leads'` no CRM Builder antes do merge e trocar onde for referente ao Builder.

Confirma que sigo assim?
