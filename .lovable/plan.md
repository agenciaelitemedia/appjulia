

## Plano: Filtrar usuário vinculado por `role = 'user'`

### Alteração

**Arquivo: `supabase/functions/db-query/index.ts`** — case `get_agent_details` (linha ~851-852)

Alterar o JOIN de:
```sql
LEFT JOIN user_agents ua ON ua.agent_id = a.id
LEFT JOIN users u ON u.id = ua.user_id
```

Para:
```sql
LEFT JOIN user_agents ua ON ua.agent_id = a.id
LEFT JOIN users u ON u.id = ua.user_id AND u.role = 'user'
```

Isso garante que apenas o proprietário (role `user`) seja retornado, ignorando membros de equipe sem usar `NOT IN`.

