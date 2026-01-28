

# Plano: Selecao de Modulos e Agentes (incluindo Monitorados) ao Criar/Editar Membro da Equipe

## Visao Geral

Adicionar a funcionalidade de selecionar:
1. **Modulos** que o membro da equipe pode acessar (limitado aos modulos do usuario pai)
2. **Agentes** incluindo tanto "Meus Agentes" quanto "Agentes Monitorados" do usuario pai

---

## Estrutura de Agentes

A tabela `user_agents` possui dois tipos de vinculo:

| Tipo | agent_id | cod_agent | Descricao |
|------|----------|-----------|-----------|
| Meus Agentes | Preenchido | Preenchido | Vinculo completo com o agente |
| Monitorados | NULL | Preenchido | Vinculo apenas por codigo (observacao) |

Ambos os tipos poderao ser atribuidos aos membros da equipe.

---

## Fluxo de Usuario

```text
+-------------------------------------------------------------------+
|  Novo Membro da Equipe                                       [X]  |
+-------------------------------------------------------------------+
|                                                                   |
|  Nome:   [________________________________]                       |
|                                                                   |
|  Email:  [________________________________]                       |
|                                                                   |
|  +---------------------------------------------------------+      |
|  | AGENTES COM ACESSO                                      |      |
|  |                                                         |      |
|  | MEUS AGENTES (vinculo completo)                         |      |
|  | [x] Empresa A - #20250101                               |      |
|  | [x] Empresa B - #20250202                               |      |
|  |                                                         |      |
|  | AGENTES MONITORADOS (apenas observacao)                 |      |
|  | [ ] Empresa C - #20250303                               |      |
|  | [x] Empresa D - #20250404                               |      |
|  +---------------------------------------------------------+      |
|                                                                   |
|  +---------------------------------------------------------+      |
|  | MODULOS COM ACESSO                                      |      |
|  |                                                         |      |
|  | PRINCIPAL                                               |      |
|  | [x] Dashboard                                           |      |
|  |                                                         |      |
|  | CRM                                                     |      |
|  | [x] Leads             [x] Monitoramento                 |      |
|  |                                                         |      |
|  | AGENTE                                                  |      |
|  | [x] Meus Agentes      [x] FollowUp                      |      |
|  +---------------------------------------------------------+      |
|                                                                   |
|                            [Cancelar]  [Criar Membro]             |
+-------------------------------------------------------------------+
```

---

## Estrutura de Arquivos

```text
src/pages/equipe/
  components/
    AgentCheckboxList.tsx      <- ATUALIZAR: Separar em secoes (Meus Agentes / Monitorados)
    ModuleCheckboxList.tsx     <- NOVO: Lista de modulos com checkboxes
    EquipeMemberDialog.tsx     <- ATUALIZAR: Incluir selecao de modulos
  hooks/
    useEquipeData.ts           <- ATUALIZAR: Novos hooks para modulos e agentes monitorados
```

---

## Regras de Negocio

| Regra | Descricao |
|-------|-----------|
| Agentes do pai | Membro TIME so pode ter acesso a agentes que o usuario pai possui |
| Ambos os tipos | Tanto "Meus Agentes" quanto "Monitorados" podem ser passados |
| Heranca de modulos | Membro TIME so pode ter acesso a modulos que o usuario pai tem |
| Modulos excluidos | Modulos 'team' e 'settings' nao estao disponiveis para membros TIME |
| Categorias filtradas | Categorias 'admin' e 'financeiro' nao aparecem |
| Permissoes customizadas | Membro tera `use_custom_permissions = true` automaticamente |

---

## Tarefa 1: Atualizar Edge Function - Buscar Agentes incluindo Monitorados

Modificar a action `get_user_agents_for_principal` para retornar ambos os tipos:

```sql
SELECT 
  ua.agent_id,
  ua.cod_agent::text as cod_agent,
  COALESCE(a.status, true) as status,
  COALESCE(c.business_name, 'Agente ' || ua.cod_agent) as business_name,
  CASE WHEN ua.agent_id IS NOT NULL THEN 'own' ELSE 'monitored' END as agent_type
FROM user_agents ua
LEFT JOIN agents a ON a.id = ua.agent_id OR a.cod_agent::text = ua.cod_agent::text
LEFT JOIN clients c ON c.id = a.client_id
WHERE ua.user_id = $1
ORDER BY 
  CASE WHEN ua.agent_id IS NOT NULL THEN 0 ELSE 1 END,
  c.business_name
```

---

## Tarefa 2: Atualizar AgentCheckboxList

Separar a lista em duas secoes visuais:

```typescript
interface AgentWithType extends PrincipalUserAgent {
  agent_type: 'own' | 'monitored';
}

// Renderizar
const ownAgents = agents.filter(a => a.agent_type === 'own');
const monitoredAgents = agents.filter(a => a.agent_type === 'monitored');

return (
  <div>
    {/* Secao Meus Agentes */}
    <h4>Meus Agentes ({ownAgents.length})</h4>
    {renderAgentList(ownAgents)}
    
    {/* Secao Monitorados */}
    {monitoredAgents.length > 0 && (
      <>
        <h4>Agentes Monitorados ({monitoredAgents.length})</h4>
        {renderAgentList(monitoredAgents)}
      </>
    )}
  </div>
);
```

---

## Tarefa 3: Criar ModuleCheckboxList

Novo componente para selecao de modulos:

```typescript
interface ModuleCheckboxListProps {
  parentPermissions: UserPermission[];
  selectedModuleCodes: string[];
  onChange: (codes: string[]) => void;
  isLoading?: boolean;
}

const excludedModules = ['team', 'settings'];
const allowedCategories = ['principal', 'crm', 'agente', 'sistema'];

// Filtrar e agrupar modulos por categoria
// Renderizar com checkboxes agrupados
```

---

## Tarefa 4: Atualizar useEquipeData.ts

Adicionar hooks:

```typescript
// Hook para buscar permissoes do usuario pai
export function useParentUserPermissions(parentUserId: number | null) {
  return useQuery({
    queryKey: ['parent-user-permissions', parentUserId],
    queryFn: () => externalDb.getUserPermissions(parentUserId!),
    enabled: !!parentUserId,
  });
}
```

Modificar mutations para aceitar `modulePermissions`:

```typescript
export function useCreateTeamMember() {
  return useMutation({
    mutationFn: async (data: {
      name: string;
      email: string;
      principalUserId: number;
      agentIds: { agentId: number | null; codAgent: string }[];  // agentId pode ser null
      modulePermissions: { moduleCode: string }[];
    }) => {
      // ... incluir modulePermissions na chamada
    },
  });
}
```

---

## Tarefa 5: Atualizar Edge Function - insert_team_member

Modificar para:
1. Aceitar `agentId` como nullable (para monitorados)
2. Inserir permissoes de modulos

```typescript
case 'insert_team_member': {
  const { name, email, hashedPassword, rawPassword, principalUserId, clientId, agentIds, modulePermissions } = data;
  
  // Insert user com use_custom_permissions = true
  const userRows = await sql.unsafe(
    `INSERT INTO users (name, email, password, remember_token, role, user_id, client_id, use_custom_permissions, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'time', $5, $6, TRUE, now(), now())
     RETURNING id, name, email`,
    [name, email, hashedPassword, rawPassword, principalUserId, clientId]
  );
  
  const newUserId = userRows[0].id;
  
  // Insert user_agents (agentId pode ser null para monitorados)
  for (const agent of agentIds) {
    await sql.unsafe(
      `INSERT INTO user_agents (user_id, agent_id, cod_agent, created_at)
       VALUES ($1, $2, $3::bigint, now())`,
      [newUserId, agent.agentId, agent.codAgent]  // agentId pode ser null
    );
  }
  
  // Insert user_permissions para modulos selecionados
  if (modulePermissions && modulePermissions.length > 0) {
    for (const mod of modulePermissions) {
      await sql.unsafe(
        `INSERT INTO user_permissions (user_id, module_id, can_view, can_create, can_edit, can_delete)
         SELECT $1, id, TRUE, TRUE, TRUE, FALSE FROM modules WHERE code = $2`,
        [newUserId, mod.moduleCode]
      );
    }
  }
  
  result = userRows;
  break;
}
```

---

## Tarefa 6: Atualizar Edge Function - update_team_member

Modificar para sincronizar permissoes de modulos:

```typescript
case 'update_team_member': {
  const { memberId, name, principalUserId, agentIds, modulePermissions } = data;
  
  // Update user
  await sql.unsafe(
    `UPDATE users SET name = $1, user_id = $2, updated_at = now() WHERE id = $3`,
    [name, principalUserId, memberId]
  );
  
  // Sync user_agents
  await sql.unsafe(`DELETE FROM user_agents WHERE user_id = $1`, [memberId]);
  for (const agent of agentIds) {
    await sql.unsafe(
      `INSERT INTO user_agents (user_id, agent_id, cod_agent, created_at)
       VALUES ($1, $2, $3::bigint, now())`,
      [memberId, agent.agentId, agent.codAgent]
    );
  }
  
  // Sync user_permissions
  if (modulePermissions) {
    await sql.unsafe(`DELETE FROM user_permissions WHERE user_id = $1`, [memberId]);
    for (const mod of modulePermissions) {
      await sql.unsafe(
        `INSERT INTO user_permissions (user_id, module_id, can_view, can_create, can_edit, can_delete)
         SELECT $1, id, TRUE, TRUE, TRUE, FALSE FROM modules WHERE code = $2`,
        [memberId, mod.moduleCode]
      );
    }
  }
  
  result = [{ success: true }];
  break;
}
```

---

## Tarefa 7: Atualizar externalDb.ts

Modificar tipos para suportar agentes monitorados e modulos:

```typescript
async insertTeamMember<T = any>(data: {
  name: string;
  email: string;
  hashedPassword: string;
  rawPassword: string;
  principalUserId: number;
  clientId: number | null;
  agentIds: { agentId: number | null; codAgent: string }[];  // agentId nullable
  modulePermissions?: { moduleCode: string }[];
}): Promise<T>

async updateTeamMember<T = any>(data: {
  memberId: number;
  name: string;
  principalUserId: number;
  agentIds: { agentId: number | null; codAgent: string }[];  // agentId nullable
  modulePermissions?: { moduleCode: string }[];
}): Promise<T>
```

---

## Tarefa 8: Atualizar EquipeMemberDialog

Adicionar:
1. Estado para modulos selecionados
2. Hook para buscar permissoes do pai
3. Componente ModuleCheckboxList
4. Logica para carregar modulos atuais ao editar

```typescript
const [selectedModuleCodes, setSelectedModuleCodes] = useState<string[]>([]);

// Buscar permissoes do pai
const { data: parentPermissions = [] } = useParentUserPermissions(user?.id);

// Ao editar, carregar modulos atuais do membro
const loadMemberModules = async (memberId: number) => {
  const permissions = await externalDb.getUserPermissions(memberId);
  const codes = permissions
    .filter(p => p.can_view)
    .map(p => p.module_code);
  setSelectedModuleCodes(codes);
};
```

---

## Tarefa 9: Atualizar types.ts da Equipe

Adicionar tipo para agente com tipo:

```typescript
export interface PrincipalUserAgent {
  agent_id: number | null;  // null para monitorados
  cod_agent: string;
  status: boolean;
  business_name: string;
  agent_type: 'own' | 'monitored';
}
```

---

## Diagrama de Fluxo

```text
Usuario Pai (logado)
       |
       +-- get_user_agents_for_principal() --> Meus Agentes + Monitorados
       |
       +-- get_user_permissions() --> Modulos do pai
       |
       v
+-----------------------+
| Filtrar modulos       |
| - Excluir admin/fin   |
| - Excluir team/settings|
+-----------------------+
       |
       v
+-----------------------+
| Exibir checkboxes     |
| - Agentes separados   |
| - Modulos agrupados   |
+-----------------------+
       |
       v
(usuario seleciona)
       |
       v
+-----------------------+
| insert_team_member()  |
| - user_agents (all)   |
| - user_permissions    |
+-----------------------+
```

---

## Ordem de Implementacao

1. Atualizar Edge Function `get_user_agents_for_principal` para incluir monitorados
2. Atualizar `PrincipalUserAgent` type com `agent_type`
3. Atualizar `AgentCheckboxList` para exibir secoes separadas
4. Criar componente `ModuleCheckboxList`
5. Adicionar hook `useParentUserPermissions` em `useEquipeData.ts`
6. Atualizar Edge Function `insert_team_member` com modulos
7. Atualizar Edge Function `update_team_member` com modulos
8. Atualizar `externalDb.ts` com novos campos
9. Atualizar mutations em `useEquipeData.ts`
10. Atualizar `EquipeMemberDialog` com selecao de modulos
11. Testar criacao de membro com agentes monitorados e modulos
12. Testar edicao de membro

