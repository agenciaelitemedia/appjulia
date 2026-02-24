
## Mostrar senha na lista de permissoes

### O que muda

Exibir o `remember_token` (senha nao trocada) abaixo do email de cada usuario na lista lateral da tela de permissoes, usando o mesmo estilo da tela de equipe (icone de chave + texto monospace + botao copiar).

### Alteracoes

#### 1. `supabase/functions/db-query/index.ts` (case `get_users_with_permissions`)

Adicionar `u.remember_token` ao SELECT da query:

```sql
SELECT u.id, u.name, u.email, u.role, u.use_custom_permissions, u.is_active,
       u.user_id as parent_user_id, u.created_at, u.remember_token
FROM users u
```

#### 2. `src/pages/admin/permissoes/types.ts`

Adicionar `remember_token` ao tipo `UserWithPermissions`:

```typescript
export interface UserWithPermissions {
  // ... campos existentes
  remember_token: string | null;
}
```

#### 3. `src/pages/admin/permissoes/components/UserPermissionsList.tsx`

Abaixo da linha do email (linha 127-128), adicionar condicional que mostra a senha quando `remember_token` existir:

- Importar `Key`, `Copy`, `Check` do lucide-react
- Importar `Tooltip` do radix
- Adicionar estado `copiedId` para controlar feedback de copia
- Renderizar a senha com icone de chave, texto monospace e botao copiar (mesmo padrao do `EquipeMemberCard`)

### Arquivos modificados

- `supabase/functions/db-query/index.ts` -- adicionar campo na query
- `src/pages/admin/permissoes/types.ts` -- adicionar campo no tipo
- `src/pages/admin/permissoes/components/UserPermissionsList.tsx` -- exibir senha com botao copiar
