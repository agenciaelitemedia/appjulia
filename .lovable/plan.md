## Contexto

A rota `/admin/operacoes` já existe em `src/App.tsx` (linha 183), renderizando `OperacoesMonitorPage`, e está protegida por `ProtectedRoute module="admin_agents"` — ou seja, qualquer admin já tem acesso direto via URL. O que falta é apenas o item no menu lateral.

A tabela `modules` fica no banco externo (não no Supabase), e o padrão do projeto para registrar módulos é criar um hook `useEnsure...Module` que insere o registro automaticamente quando um admin loga, e chamá-lo no `Sidebar.tsx`. Esse padrão já é usado por ~16 módulos (Contatos, Webhook Monitor, etc.).

## Implementação

### 1. Criar `src/hooks/useEnsureOperacoesModule.ts`
Seguindo exatamente o padrão de `useEnsureContactsModule.ts`:
- Buscar módulos existentes via `externalDb.getModules()`
- Se já existir `code === 'admin_operacoes'`: garantir `route='/admin/operacoes'`, `is_menu_visible=true`, `menu_group='ADMINISTRATIVO'`
- Se não existir: criar com:
  - `code: 'admin_operacoes'`
  - `name: 'Operações'`
  - `route: '/admin/operacoes'`
  - `icon: 'Activity'` (já disponível em `iconMap.ts`)
  - `menu_group: 'ADMINISTRATIVO'`
  - `display_order: 60`
  - `is_active: true`, `is_menu_visible: true`
  - `category: 'admin'`

### 2. Registrar o hook em `src/components/layout/Sidebar.tsx`
Adicionar `import { useEnsureOperacoesModule }` e chamada `useEnsureOperacoesModule()` junto com os outros `useEnsure*Module()`.

### 3. Acessibilidade
Como a rota usa `module="admin_agents"` no `ProtectedRoute`, e `AdminRoute`/`ProtectedRoute` liberam tudo para admin, o item aparecerá e funcionará para admins assim que o registro for criado (no próximo login/refresh do admin atual o hook insere e invalida `menu-modules`). Nenhum ajuste extra de permissões necessário.

## Arquivos alterados
- `src/hooks/useEnsureOperacoesModule.ts` (novo)
- `src/components/layout/Sidebar.tsx` (1 import + 1 chamada)