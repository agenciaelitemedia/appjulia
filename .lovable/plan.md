

## Remover permissoes fixas e permitir delegacao do grupo Administrativo

### Problema atual

1. **`ModuleCheckboxList.tsx`** (tela de Equipe) possui categorias permitidas fixas no codigo:
   ```
   const allowedCategories = ['principal', 'crm', 'agente', 'sistema'];
   ```
   Isso impede que modulos das categorias `admin` e `financeiro` sejam atribuidos a membros da equipe.

2. **`App.tsx`** usa `<AdminRoute />` que verifica `user.role === 'admin'` de forma fixa, bloqueando qualquer usuario nao-admin de acessar rotas `/admin/*`, mesmo que tenha permissao via sistema de permissoes.

3. **`PermissionMatrix.tsx`** ja lista todas as categorias incluindo `admin` e `financeiro`, entao a tela de permissoes do admin ja funciona corretamente.

### Alteracoes planejadas

#### 1. `src/pages/equipe/components/ModuleCheckboxList.tsx`

- Remover a constante `allowedCategories` e o filtro fixo por categoria
- Manter apenas o filtro de `excludedModules` (team, settings) e a verificacao `can_view` do pai
- Adicionar labels para as categorias `admin` e `financeiro` no `categoryLabels`
- Resultado: se o usuario principal tem permissao a modulos administrativos, ele pode conceder esses mesmos modulos aos membros da sua equipe

Antes:
```typescript
const allowedCategories = ['principal', 'crm', 'agente', 'sistema'];

const validModules = parentPermissions.filter(
  (m) => m.can_view && !excludedModules.includes(m.module_code) && allowedCategories.includes(m.category)
);
```

Depois:
```typescript
const validModules = parentPermissions.filter(
  (m) => m.can_view && !excludedModules.includes(m.module_code)
);
```

#### 2. `src/App.tsx` - Substituir `AdminRoute` por `ProtectedRoute`

- Trocar o `<AdminRoute />` wrapper por rotas individuais usando `<ProtectedRoute module="...">` que ja existe no projeto
- Cada rota admin passa a verificar a permissao do modulo especifico em vez do role fixo
- Exemplo:
  ```typescript
  <Route path="/admin/agentes" element={
    <ProtectedRoute module="admin_agents">
      <AgentsList />
    </ProtectedRoute>
  } />
  ```
- Rotas sem modulo definido (meta-test, meta-ads) continuam restritas a admin usando `module="admin_agents"` ou similar

#### 3. `src/components/guards/AdminRoute.tsx`

- Manter o arquivo para compatibilidade, mas nao sera mais usado nas rotas. Pode ser removido ou marcado como deprecated.

### Mapeamento de rotas para modulos

| Rota | Modulo |
|------|--------|
| `/admin/agentes` | `admin_agents` |
| `/admin/agentes-novo` | `admin_agents` |
| `/admin/agentes/:id/editar` | `admin_agents` |
| `/admin/agentes/:id/detalhes` | `admin_agents` |
| `/admin/modulos` | `admin_agents` (ou modulo dedicado se existir) |
| `/admin/permissoes` | `admin_agents` (ou modulo dedicado se existir) |
| `/admin/meta-test` | `admin_agents` |
| `/admin/meta-ads` | `admin_agents` |

### Fluxo apos a mudanca

1. Admin concede permissao do grupo "Administrativo" a um usuario (tela Permissoes)
2. O usuario agora ve os modulos admin no menu lateral (ja funciona via `useMenuModules`)
3. As rotas `/admin/*` passam a ser acessiveis porque `ProtectedRoute` verifica permissao no modulo em vez do role
4. Na tela de Equipe, se esse usuario criar membros, ele pode delegar os modulos admin que possui

### Arquivos modificados

- `src/pages/equipe/components/ModuleCheckboxList.tsx` - remover categorias fixas
- `src/App.tsx` - trocar AdminRoute por ProtectedRoute em cada rota admin

