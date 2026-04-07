

# Cadastrar módulo `adv_dashboard` e auto-atribuir ao perfil advogado

## Problema

O módulo `adv_dashboard` não existe na tabela `modules` do banco externo. Quando um advogado é criado, o frontend adiciona `adv_dashboard` na lista de `modulePermissions`, mas o INSERT de permissão faz `SELECT id FROM modules WHERE code = 'adv_dashboard'` — que retorna vazio. Logo, nenhuma permissão é gravada.

Além disso, o `hasPermission` no `AuthContext` não tem fallback para advogados, então o `ProtectedRoute` bloqueia o acesso.

## Correção

### 1. Inserir módulo `adv_dashboard` na tabela de módulos (via edge function)

Adicionar no `create_module` do `role_default_permissions` o role `'advogado'` com `can_view = TRUE` por padrão.

Também precisamos inserir o módulo via chamada na inicialização ou via um script. A forma mais simples: adicionar uma action `ensure_adv_module` na edge function que faz um `INSERT ... ON CONFLICT DO NOTHING` do módulo `adv_dashboard`.

**Alternativa mais limpa**: Chamar `externalDb.createModule()` uma vez para cadastrar. Mas como o módulo precisa existir permanentemente, vamos adicionar ao `init_permission_system` ou `migrate_modules_schema` um INSERT do módulo `adv_dashboard`.

### 2. Garantir role `advogado` no `role_default_permissions`

No `create_module` (linha 1636-1645), a query de `role_default_permissions` só inclui `('admin'), ('colaborador'), ('user'), ('time')`. Precisa adicionar `('advogado'), ('comercial')`.

### 3. Auto-atribuir `adv_dashboard` no `insert_team_member`

No backend, quando `role === 'advogado'`, garantir que `adv_dashboard` está nas permissões mesmo que o frontend não envie (safety net).

### 4. Fallback no `hasPermission` do AuthContext

Adicionar: se `user.role === 'advogado'` e `moduleCode === 'adv_dashboard'`, retornar `true` automaticamente (garante acesso mesmo se a permissão não estiver no banco ainda).

## Alterações

| Arquivo | Mudança |
|---|---|
| `supabase/functions/db-query/index.ts` | 1) `create_module`: adicionar roles `advogado` e `comercial` no `role_default_permissions`. 2) `insert_team_member`: auto-incluir `adv_dashboard` quando role=advogado. 3) Nova action `ensure_adv_module` para criar o módulo se não existir |
| `src/contexts/AuthContext.tsx` | `hasPermission`: advogado sempre tem acesso a `adv_dashboard` |
| `src/pages/adv/AdvDashboardPage.tsx` | Chamar `externalDb` para garantir módulo existe (on mount, uma vez) — ou melhor, fazer isso no login |

## Fluxo corrigido

1. Módulo `adv_dashboard` é inserido na tabela `modules` (via ensure ou migrate)
2. Ao criar membro com role `advogado`, o backend auto-inclui permissão `adv_dashboard`
3. `hasPermission` no frontend dá fallback positivo para advogado + adv_dashboard
4. `ProtectedRoute` permite acesso

