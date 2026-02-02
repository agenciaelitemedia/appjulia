
# Plano: Sincronizar Permissoes de Cargo com Tabela Modules

## Problema Identificado

O dialog "Editar Permissoes Padrao" (RoleDefaultsDialog) nao mostra todos os modulos da tabela `modules`. Isso ocorre porque:

1. A action `get_role_default_permissions` faz um `JOIN` restritivo - retorna apenas modulos que **ja existem** na tabela `role_default_permissions`
2. Quando novos modulos sao criados via `/admin/modulos`, eles **nao sao adicionados** automaticamente a `role_default_permissions`

### Fluxo Atual (Quebrado)
```
Criar Modulo → Insere em 'modules' → NAO insere em 'role_default_permissions' → Modulo invisivel no dialog de cargo
```

### Fluxo Desejado
```
Criar Modulo → Insere em 'modules' → Insere em 'role_default_permissions' para TODOS os cargos → Modulo aparece no dialog
```

---

## Solucao

### 1. Corrigir `get_role_default_permissions`

Alterar o JOIN para retornar **TODOS os modulos ativos**, mesmo que nao tenham registro em `role_default_permissions`:

**Antes:**
```sql
SELECT m.code, m.name, m.category, rdp.can_view, rdp.can_create, rdp.can_edit, rdp.can_delete
FROM role_default_permissions rdp
JOIN modules m ON m.id = rdp.module_id
WHERE rdp.role = $1 AND m.is_active = TRUE
```

**Depois:**
```sql
SELECT m.code, m.name, m.category,
       COALESCE(rdp.can_view, FALSE) as can_view,
       COALESCE(rdp.can_create, FALSE) as can_create,
       COALESCE(rdp.can_edit, FALSE) as can_edit,
       COALESCE(rdp.can_delete, FALSE) as can_delete
FROM modules m
LEFT JOIN role_default_permissions rdp ON m.id = rdp.module_id AND rdp.role = $1
WHERE m.is_active = TRUE
ORDER BY m.display_order
```

### 2. Corrigir `create_module`

Apos inserir o modulo, automaticamente criar registros em `role_default_permissions` para todos os cargos:

```sql
-- Apos INSERT INTO modules RETURNING id
INSERT INTO role_default_permissions (role, module_id, can_view, can_create, can_edit, can_delete)
SELECT role, $moduleId, 
       CASE WHEN role = 'admin' THEN TRUE ELSE FALSE END,
       CASE WHEN role = 'admin' THEN TRUE ELSE FALSE END,
       CASE WHEN role = 'admin' THEN TRUE ELSE FALSE END,
       CASE WHEN role = 'admin' THEN TRUE ELSE FALSE END
FROM (VALUES ('admin'), ('colaborador'), ('user'), ('time')) AS roles(role)
ON CONFLICT (role, module_id) DO NOTHING
```

### 3. Corrigir `update_role_default_permissions`

Usar UPSERT em vez de UPDATE para criar registros que nao existem:

```sql
INSERT INTO role_default_permissions (role, module_id, can_view, can_create, can_edit, can_delete)
VALUES ($role, $moduleId, $canView, $canCreate, $canEdit, $canDelete)
ON CONFLICT (role, module_id) DO UPDATE SET 
  can_view = $canView, can_create = $canCreate, can_edit = $canEdit, can_delete = $canDelete
```

### 4. Sincronizar modulos existentes

Adicionar uma action `sync_role_permissions` que cria registros faltantes para modulos existentes:

```sql
INSERT INTO role_default_permissions (role, module_id, can_view, can_create, can_edit, can_delete)
SELECT r.role, m.id, 
       CASE WHEN r.role = 'admin' THEN TRUE ELSE FALSE END,
       CASE WHEN r.role = 'admin' THEN TRUE ELSE FALSE END,
       CASE WHEN r.role = 'admin' THEN TRUE ELSE FALSE END,
       CASE WHEN r.role = 'admin' THEN TRUE ELSE FALSE END
FROM modules m
CROSS JOIN (VALUES ('admin'), ('colaborador'), ('user'), ('time')) AS r(role)
WHERE m.is_active = TRUE
ON CONFLICT (role, module_id) DO NOTHING
```

---

## Arquivo a Modificar

| Arquivo | Mudancas |
|---------|----------|
| `supabase/functions/db-query/index.ts` | Corrigir 3 actions + adicionar sync |

---

## Detalhes Tecnicos

### Action `get_role_default_permissions` (linhas 1633-1644)

```typescript
case 'get_role_default_permissions': {
  const { role } = data;
  result = await sql.unsafe(`
    SELECT m.code as module_code, m.name as module_name, m.category,
           COALESCE(rdp.can_view, FALSE) as can_view, 
           COALESCE(rdp.can_create, FALSE) as can_create, 
           COALESCE(rdp.can_edit, FALSE) as can_edit, 
           COALESCE(rdp.can_delete, FALSE) as can_delete
    FROM modules m
    LEFT JOIN role_default_permissions rdp ON m.id = rdp.module_id AND rdp.role = $1
    WHERE m.is_active = TRUE
    ORDER BY m.display_order
  `, [role]);
  break;
}
```

### Action `create_module` (linhas 1526-1536)

```typescript
case 'create_module': {
  const { moduleData } = data;
  const { code, name, description, category, icon, route, menu_group, is_menu_visible, display_order } = moduleData;
  
  const inserted = await sql.unsafe(
    `INSERT INTO modules (code, name, description, category, icon, route, menu_group, is_menu_visible, display_order, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)
     RETURNING *`,
    [code, name, description || null, category, icon || null, route || null, menu_group || null, is_menu_visible ?? true, display_order || 0]
  );
  
  // Criar permissoes padrao para todos os cargos
  if (inserted.length > 0) {
    const moduleId = inserted[0].id;
    await sql.unsafe(`
      INSERT INTO role_default_permissions (role, module_id, can_view, can_create, can_edit, can_delete)
      SELECT role, $1, 
             CASE WHEN role = 'admin' THEN TRUE ELSE FALSE END,
             CASE WHEN role = 'admin' THEN TRUE ELSE FALSE END,
             CASE WHEN role = 'admin' THEN TRUE ELSE FALSE END,
             CASE WHEN role = 'admin' THEN TRUE ELSE FALSE END
      FROM (VALUES ('admin'), ('colaborador'), ('user'), ('time')) AS r(role)
      ON CONFLICT (role, module_id) DO NOTHING
    `, [moduleId]);
  }
  
  result = inserted;
  break;
}
```

### Action `update_role_default_permissions` (linhas 1684-1705)

```typescript
case 'update_role_default_permissions': {
  const { role, permissions } = data;

  for (const perm of permissions) {
    const moduleResult = await sql.unsafe(
      `SELECT id FROM modules WHERE code = $1`,
      [perm.moduleCode]
    );
    
    if (moduleResult.length > 0) {
      // Usar UPSERT para criar/atualizar
      await sql.unsafe(
        `INSERT INTO role_default_permissions (role, module_id, can_view, can_create, can_edit, can_delete)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (role, module_id) DO UPDATE SET
           can_view = $3, can_create = $4, can_edit = $5, can_delete = $6`,
        [role, moduleResult[0].id, perm.canView, perm.canCreate, perm.canEdit, perm.canDelete]
      );
    }
  }

  result = [{ success: true }];
  break;
}
```

---

## Resultado Esperado

Apos implementar:

1. **Todos os modulos ativos** aparecerao no dialog "Editar Permissoes Padrao"
2. **Novos modulos** criados via `/admin/modulos` ja terao registros de permissao
3. **Salvar permissoes** funcionara mesmo para modulos que nao tinham registro anterior
4. Sistema totalmente sincronizado entre `modules` e `role_default_permissions`
