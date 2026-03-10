

## Diagnóstico: Módulo "Campanha Ads" não atualiza para usuários `time`

### Causa raiz

Encontrei **dois problemas** no backend (`db-query/index.ts`):

#### Problema 1: `update_team_member` não garante `use_custom_permissions = TRUE`

Ao criar um membro (`insert_team_member`, linha 1124), o campo `use_custom_permissions` é definido como `TRUE`. Porém, ao atualizar (`update_team_member`, linha 1160), o UPDATE na tabela `users` **não inclui** `use_custom_permissions = TRUE`. Se por algum motivo o valor estiver `FALSE` no banco, as permissões salvas em `user_permissions` são ignoradas — o sistema lê os defaults do role em vez das permissões customizadas.

#### Problema 2: Intersecção com permissões do pai usa role hardcoded

Na leitura de permissões de usuários `time` (linhas 1490-1498), o código busca as permissões do pai usando:
```sql
LEFT JOIN role_default_permissions rdp ON rdp.module_id = m.id AND rdp.role = 'user'
```
Isso usa o role `'user'` fixo em vez de buscar as **permissões reais** do pai. Se o módulo "Campanha Ads" não estiver nos defaults do role `'user'`, a intersecção zera o `can_view`, mesmo que o pai tenha a permissão customizada.

### Correções

**Arquivo:** `supabase/functions/db-query/index.ts`

1. No case `update_team_member` (linha 1160-1163), adicionar `use_custom_permissions = TRUE` no UPDATE:
```sql
UPDATE users SET name = $1, user_id = $2, use_custom_permissions = TRUE, updated_at = now() WHERE id = $3
```

2. No case `get_user_permissions`, bloco `time` (linhas 1489-1516), substituir a query hardcoded por uma chamada recursiva que busca as permissões reais do pai (reutilizando a mesma lógica de custom vs default do pai):
```sql
-- Se o pai tem use_custom_permissions = TRUE, usar user_permissions do pai
-- Se não, usar role_default_permissions do role do pai (não hardcoded 'user')
```

Isso garante que a intersecção reflita o acesso real do pai, independente de ser admin, colaborador ou user com permissões customizadas.

### Resumo de alterações

| Arquivo | Alteração |
|---|---|
| `supabase/functions/db-query/index.ts` | Fix UPDATE em `update_team_member` + fix intersecção de permissões para `time` |

