

# View `vw_equipe` + filtro de responsáveis no /chat

## Objetivo

Trazer no filtro "Responsável" do `/chat` **todos os membros da equipe pertencentes ao mesmo client_id** do usuário logado, resolvendo `client_id` automaticamente conforme o role.

## Regra de resolução do `client_id`

| Role do usuário logado | Origem do `client_id` |
|---|---|
| `admin` (super), `colaborador`, `user` | `users.client_id` (direto) |
| Outros roles (`time`, `advogado`, `comercial`, etc.) | `client_id` do usuário principal referenciado em `users.user_id` |

Quando `admin` for super (sem client_id), retorna todos.

## Mudanças

### 1. Banco externo — criar `vw_equipe` (migration externa via Edge Function)

```sql
CREATE OR REPLACE VIEW vw_equipe AS
SELECT
  u.id,
  u.name,
  u.email,
  u.role,
  u.user_id          AS parent_user_id,
  COALESCE(u.client_id, p.client_id) AS client_id,
  c.photo,
  c.business_name    AS client_business_name
FROM users u
LEFT JOIN users   p ON p.id = u.user_id
LEFT JOIN clients c ON c.id = COALESCE(u.client_id, p.client_id)
WHERE u.role IN ('admin','user','colaborador','time','advogado','comercial');
```

Como o banco é externo (não Supabase), a criação será feita via uma Edge Function utilitária one-shot (`run-external-sql`) ou incluída como ação no `db-query`. Optaremos pela **segunda**: adicionar uma ação `create_vw_equipe` em `db-query` que executa o `CREATE OR REPLACE VIEW` (idempotente). Disparamos uma vez após deploy.

### 2. `db-query` — nova ação `get_team_by_client`

```ts
case 'get_team_by_client': {
  const { userId, role } = data;
  // Resolve client_id efetivo
  const me = await sql.unsafe(
    `SELECT COALESCE(u.client_id, p.client_id) AS client_id
     FROM users u LEFT JOIN users p ON p.id = u.user_id
     WHERE u.id = $1 LIMIT 1`, [userId]
  );
  const clientId = me[0]?.client_id;
  // Super-admin sem client_id => retorna todos
  if (role === 'admin' && !clientId) {
    result = await sql.unsafe(
      `SELECT id, name, email, role, client_id, photo FROM vw_equipe ORDER BY name`
    );
  } else if (clientId) {
    result = await sql.unsafe(
      `SELECT id, name, email, role, client_id, photo
       FROM vw_equipe WHERE client_id = $1 ORDER BY name`, [clientId]
    );
  } else {
    result = [];
  }
  break;
}
```

### 3. `src/lib/externalDb.ts`

Adicionar helper:
```ts
async getTeamByClient<T = any>(userId: number, role: string): Promise<T[]> {
  return this.invoke({ action: 'get_team_by_client', data: { userId, role } });
}
```

### 4. Hook novo `src/hooks/useTeamByClient.ts`

```ts
export function useTeamByClient() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['team-by-client', user?.id],
    queryFn: () => externalDb.getTeamByClient(user!.id, user!.role),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });
}
```

### 5. `src/components/chat/ChatList.tsx` — popular o select Responsável

Substituir o map de `allAgents` no `<Select>` por `teamMembers` vindo de `useTeamByClient()`:

```tsx
const { data: teamMembers = [] } = useTeamByClient();
...
{teamMembers.map((m) => (
  <SelectItem key={m.id} value={String(m.id)} className="text-xs">
    {m.name}
  </SelectItem>
))}
```

E ajustar o filtro `visibleContacts` para casar `assigned_to` com `String(m.id)` **ou** `m.name` (compatibilidade com leads antigos onde `assigned_to` foi gravado como nome):

```ts
return assigned === ownerFilter || assigned === selectedMember?.name;
```

## Arquivos

| Arquivo | Mudança |
|---|---|
| `supabase/functions/db-query/index.ts` | + ações `create_vw_equipe`, `get_team_by_client` |
| `src/lib/externalDb.ts` | + `getTeamByClient` |
| `src/hooks/useTeamByClient.ts` | novo hook |
| `src/components/chat/ChatList.tsx` | filtro de responsáveis usa novo hook |

Após deploy, disparo único de `create_vw_equipe` para materializar a view no banco externo.

## Validação

1. Logar como `admin` com `client_id` → select mostra apenas membros do mesmo client.
2. Logar como `advogado` (role secundário) → resolve via `users.user_id` do principal e mostra a equipe deste client.
3. Logar como super-admin (sem client_id) → mostra todos.

