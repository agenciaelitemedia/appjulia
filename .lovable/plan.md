

# Plano: Página de Administração de Permissões

## Visao Geral

Criar uma interface administrativa completa para gerenciar permissões de usuarios com uma matriz visual de modulo x acao (view, create, edit, delete). A pagina permitira ao admin selecionar usuarios, visualizar e editar suas permissoes, e alternar entre permissoes padrao do role ou customizadas.

---

## Estrutura de Arquivos

```text
src/pages/admin/permissoes/
  PermissoesPage.tsx           <- Pagina principal
  components/
    PermissoesHeader.tsx       <- Cabecalho com titulo e filtros
    UserPermissionsList.tsx    <- Lista de usuarios com filtro por role
    PermissionMatrix.tsx       <- Matriz de modulos x acoes (checkboxes)
    PermissionDialog.tsx       <- Dialog para editar permissoes de um usuario
    RoleDefaultsDialog.tsx     <- Dialog para editar permissoes padrao de um role
  hooks/
    usePermissionsAdmin.ts     <- Hooks React Query para dados de permissoes
  types.ts                     <- Tipos especificos da pagina
```

---

## Componentes

### 1. PermissoesPage.tsx

Pagina principal com layout em duas colunas:
- Esquerda: Lista de usuarios com filtros
- Direita: Visualizacao/edicao das permissoes do usuario selecionado

```text
+------------------------------------------------------------+
|  Gerenciar Permissoes                    [Editar Padroes]  |
+--------------------+---------------------------------------+
| [Filtro: Todos v]  |  Usuario: Maria Silva (colaborador)  |
|                    |  [x] Usar permissoes customizadas     |
| [Buscar...]        +---------------------------------------+
|                    |  MODULO        | Ver | Add | Edt | Del|
| * Admin User       +----------------+-----+-----+-----+----+
|   Maria Silva  <-- |  Dashboard     | [x] | [ ] | [ ] | [ ]|
|   Jose Santos      |  CRM Leads     | [x] | [x] | [x] | [ ]|
|   Ana Oliveira     |  CRM Monitor   | [x] | [ ] | [ ] | [ ]|
|   ...              |  ...           | ... | ... | ... | ...|
|                    +---------------------------------------+
|                    |        [Cancelar]  [Salvar Permissoes]|
+--------------------+---------------------------------------+
```

### 2. PermissoesHeader.tsx

- Titulo "Gerenciar Permissoes"
- Botao "Editar Padraes de Role" (abre dialog para editar role_default_permissions)

### 3. UserPermissionsList.tsx

- Select para filtrar por role (Todos, admin, colaborador, user, time)
- Input de busca por nome/email
- Lista de usuarios com:
  - Nome e email
  - Badge do role
  - Indicador se usa permissoes customizadas
  - Indicador se esta ativo/inativo

### 4. PermissionMatrix.tsx

- Tabela com modulos agrupados por categoria
- Colunas: Modulo | Ver | Criar | Editar | Excluir
- Checkboxes para cada permissao
- Cores por categoria (seguindo o padrao do Sidebar)
- Modo visualizacao ou edicao

### 5. PermissionDialog.tsx

- Dialog para editar permissoes de um usuario
- Toggle para ativar permissoes customizadas
- Matriz de permissoes editavel
- Botao para resetar para padrao do role

### 6. RoleDefaultsDialog.tsx

- Select para escolher o role
- Matriz de permissoes padrao do role selecionado
- Permite alterar as permissoes padrao globais

---

## Hooks (usePermissionsAdmin.ts)

```typescript
// Buscar usuarios com info de permissoes
function useUsersWithPermissions(roleFilter?: string)

// Buscar permissoes de um usuario especifico
function useUserPermissions(userId: number)

// Buscar modulos
function useModules()

// Buscar permissoes padrao de um role
function useRoleDefaultPermissions(role: string)

// Mutacao: atualizar permissoes de usuario
function useUpdateUserPermissions()

// Mutacao: atualizar permissoes padrao do role
function useUpdateRoleDefaultPermissions()
```

---

## Integracao com Backend

Os endpoints ja existem na edge function `db-query`:

| Acao                        | Endpoint                      | Implementado |
|-----------------------------|-------------------------------|--------------|
| Listar usuarios             | `get_users_with_permissions`  | Sim          |
| Permissoes do usuario       | `get_user_permissions`        | Sim          |
| Listar modulos              | `get_modules`                 | Sim          |
| Permissoes padrao do role   | `get_role_default_permissions`| Sim          |
| Atualizar permissoes usuario| `update_user_permissions`     | Sim          |
| Atualizar padrao do role    | `update_role_default_permissions` | Sim      |

---

## Fluxo de Uso

1. Admin acessa `/admin/permissoes`
2. Ve lista de todos os usuarios (filtro padrao: todos)
3. Clica em um usuario para ver suas permissoes
4. Se o usuario usa permissoes do role, mostra badge "Padrao do Role"
5. Admin pode ativar "Usar permissoes customizadas"
6. Edita checkboxes da matriz
7. Clica em "Salvar"
8. Sistema atualiza e mostra toast de sucesso

---

## Regras de Negocio

1. **Admin tem tudo**: Usuarios admin sempre tem acesso total, nao editavel
2. **TIME herda**: Usuarios TIME tem permissoes limitadas pelo pai (mostrar aviso)
3. **Padrao vs Customizado**: Toggle claro entre usar padrao do role ou custom
4. **Validacao visual**: Mostrar diferenca entre padrao e customizado com cores

---

## Integracao com Rotas

Adicionar rota no `App.tsx`:
```typescript
<Route path="/admin/permissoes" element={<PermissoesPage />} />
```

Adicionar item no menu Sidebar em "ADMINISTRATIVO":
```typescript
{ label: "Permissoes", icon: Shield, href: "/admin/permissoes" }
```

---

## Secao Tecnica

### Estrutura de Dados

```typescript
// Usuario com info de permissao
interface UserWithPermissions {
  id: number;
  name: string;
  email: string;
  role: AppRole;
  use_custom_permissions: boolean;
  is_active: boolean;
  parent_user_id: number | null;
  created_at: string;
}

// Permissao para exibicao na matriz
interface PermissionRow {
  moduleCode: ModuleCode;
  moduleName: string;
  category: ModuleCategory;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  isDefault?: boolean; // para comparacao visual
}
```

### Estado do Componente Principal

```typescript
const [selectedUser, setSelectedUser] = useState<UserWithPermissions | null>(null);
const [roleFilter, setRoleFilter] = useState<string>('');
const [searchTerm, setSearchTerm] = useState('');
const [editMode, setEditMode] = useState(false);
const [pendingChanges, setPendingChanges] = useState<PermissionRow[]>([]);
```

### Agrupamento de Modulos por Categoria

```typescript
const categoryLabels: Record<ModuleCategory, string> = {
  principal: 'Principal',
  crm: 'CRM',
  agente: 'Agente',
  sistema: 'Sistema',
  admin: 'Administrativo',
  financeiro: 'Financeiro',
};
```

---

## Tarefas de Implementacao

1. Criar estrutura de pastas e arquivos base
2. Implementar hooks `usePermissionsAdmin.ts`
3. Criar componente `UserPermissionsList`
4. Criar componente `PermissionMatrix`
5. Criar componente `PermissionDialog`
6. Criar componente `RoleDefaultsDialog`
7. Montar `PermissoesPage` com layout completo
8. Adicionar rota em `App.tsx`
9. Adicionar item no Sidebar
10. Testar fluxo completo

