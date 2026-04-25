## Objetivo

Hoje o CRM Builder isola boards/pipelines/deals por `cod_agent`. Vamos passar a isolar por **`client_id`** para que:
- O **dono** (role `user`) crie e gerencie boards, pipelines, automações e campos personalizados.
- Toda a **equipe vinculada ao mesmo `client_id`** veja os mesmos boards e possa **criar/editar/mover deals**, mas **não** possa criar/editar/arquivar boards nem pipelines.
- Cada cliente continua vendo somente os seus dados (isolamento total entre client_ids).

---

## 1. Banco de dados (migração)

Adicionar `client_id text` (nullable inicialmente, depois NOT NULL) nas tabelas do CRM Builder e backfillar a partir do `cod_agent` atual.

**Tabelas afetadas:**
- `crm_boards`
- `crm_pipelines`
- `crm_deals`
- `crm_custom_fields`
- `crm_automation_rules`

**Passos da migração:**
1. `ALTER TABLE ... ADD COLUMN client_id text` em cada tabela.
2. Backfill: para cada linha, resolver o `client_id` do dono do `cod_agent` consultando a base externa (apenas 1 agent / 4 boards hoje, então simples). Faremos via uma única atualização pontual após confirmar o `client_id` correto do agent atual.
3. Criar índice `CREATE INDEX ON <tabela>(client_id)` em todas.
4. `ALTER COLUMN client_id SET NOT NULL` após backfill.
5. Manter `cod_agent` nas linhas (passa a representar quem criou — auditoria).

> Observação: as tabelas hoje **não têm RLS habilitada** (são acessadas por `cod_agent` puro do app, idêntico ao que já existe). Vamos manter o mesmo padrão e fazer o isolamento na camada de aplicação (filtrando por `client_id`), igual aos demais módulos do projeto. Não vamos habilitar RLS agora para não quebrar o restante do CRM.

## 2. Resolução do `client_id` no frontend

Já existe em `AuthContext`:
- `user.client_id` para usuários `role=user` (dono).
- Para sub-usuários (equipe), o `AuthContext` já hidrata o `client_id` herdado via `externalDb.getEffectiveClientId` no `restoreSession`.

Vamos:
- Em todas as páginas/hooks do CRM Builder, deixar de ler `user.cod_agent` para escopo e passar a usar `user.client_id` (string).
- Continuar usando `user.cod_agent` apenas para preencher o campo de auditoria `cod_agent` ao **criar** registros (saber quem criou).

## 3. Hooks — alterações

Trocar o filtro/insert de `cod_agent` por `client_id` em:

### `src/pages/crm-builder/hooks/useCRMBoards.ts`
- Assinatura: `useCRMBoards({ clientId, codAgent, canManage })`.
- `fetchBoards`: `.eq('client_id', clientId)`.
- `createBoard` / `updateBoard` / `archiveBoard` / `reorderBoards`: só executam se `canManage === true`; inserts gravam `client_id` + `cod_agent` (auditoria).
- Realtime: `filter: client_id=eq.${clientId}`.

### `src/pages/crm-builder/hooks/useCRMPipelines.ts`
- Filtro de leitura por `client_id`.
- Mutations protegidas por `canManage` (apenas dono cria/edita/arquiva pipelines).
- Insert grava `client_id` + `cod_agent`.

### `src/pages/crm-builder/hooks/useCRMDeals.ts`
- Filtro de leitura por `client_id` (toda a equipe vê).
- **Sem** restrição de role para criar/editar/mover deals.
- Insert grava `client_id` + `cod_agent` do usuário logado (auditoria).

### `src/pages/crm-builder/hooks/useCRMCustomFields.ts` e `useCRMAutomations.ts`
- Filtro por `client_id`.
- Mutations protegidas por `canManage` (estrutura é do dono).
- Insert grava `client_id` + `cod_agent`.

## 4. Páginas — alterações

### `src/pages/crm-builder/CRMBuilderPage.tsx`
- Calcular `clientId = String(user?.client_id || '')` e `canManage = user?.role === 'user' || user?.role === 'admin'`.
- Passar `{ clientId, codAgent, canManage }` para `useCRMBoards`.
- Esconder o botão "Criar Board" / menus de editar / arquivar quando `!canManage` (equipe vê o grid e pode entrar nos boards, mas não cria/edita/arquiva).
- O grid (`BoardGrid`) já recebe handlers — passaremos `undefined`/no-op + uma flag `canManage` para esconder os botões de edição/arquivamento nos cards.

### `src/pages/crm-builder/BoardPage.tsx`
- Usar `clientId` para os hooks de pipelines/deals/custom fields/automations.
- `canManage` controla:
  - Botão "Adicionar pipeline".
  - Editar/arquivar pipeline.
  - Acesso às telas de Custom Fields e Automations (esconder os botões para a equipe; manter visualização básica do board).
- Equipe pode normalmente: criar deal, editar deal, mover deal entre pipelines.

## 5. Tipos

`src/pages/crm-builder/types.ts`:
- Adicionar `client_id: string` em `CRMBoard`, `CRMPipeline`, `CRMDeal`, e nas interfaces auxiliares de `useCRMCustomFields` e `useCRMAutomations`.
- Manter `cod_agent` (auditoria/quem criou).

## 6. Memória do projeto

Adicionar memória `mem://features/crm/builder-client-scope` com a regra: "CRM Builder é escopado por `client_id`. Toda a equipe do mesmo client vê os mesmos boards. Apenas role `user`/`admin` pode criar/editar/arquivar boards, pipelines, custom fields e automações; demais perfis podem apenas operar deals." E atualizar a entrada já existente `CRM Builder Perms` no `index.md`.

## 7. Validações pós-deploy

- Login como dono: cria board → aparece. Login como membro de equipe (mesmo client): vê o board, consegue criar deal, **não** vê botões de criar/editar/arquivar board ou pipeline.
- Login com outro `client_id`: não vê nenhum board do primeiro.
- Realtime: criar deal como equipe reflete na tela do dono e vice-versa.

## Fora do escopo
- Não vamos habilitar RLS nas tabelas `crm_*` agora (mantém o padrão atual do projeto, evitando regressão).
- Não alteramos o CRM Comercial nem o CRM da Júlia (já têm seus próprios escopos).