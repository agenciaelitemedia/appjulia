## Objetivo
Restringir os destinatários de `internal-notification-dispatch` apenas a usuários da plataforma **Nova Júlia**, usando a view `public.vw_equipe` (que já filtra clientes provisionados na nova plataforma e expõe `user_funcao`).

## Fonte de verdade
View **`public.vw_equipe`** no banco externo, colunas:
`id, name, email, role, parent_user_id, client_id, photo, client_business_name, user_funcao`

- `client_id IS NOT NULL` → pertence à Nova Júlia
- `user_funcao = 'dono'` → dono do escritório
- `user_funcao = 'equipe'` → membro da equipe

## Mudança única
Arquivo: `supabase/functions/internal-notification-dispatch/index.ts`

Substituir o bloco de montagem da query externa (que hoje usa `FROM users u` com filtros de `client_id IS NULL/NOT NULL`) por:

```ts
const where: string[] = ["client_id IS NOT NULL"];
const params: any[] = [];

if (n.audience === "owners") {
  where.push("user_funcao = 'dono'");
} else if (n.audience === "teams") {
  where.push("user_funcao = 'equipe'");
} // 'all' → sem filtro adicional (dono + equipe da Nova Júlia)

if (n.scope === "office") {
  // restringe ao escritório do criador
  const creatorId = String(n.created_by);
  const creatorRows = await externalRaw(
    "SELECT client_id FROM public.vw_equipe WHERE id = $1 LIMIT 1",
    [creatorId],
  );
  const clientId = creatorRows?.[0]?.client_id ?? n.created_by_client_id ?? null;
  if (clientId != null) {
    params.push(clientId);
    where.push(`client_id = $${params.length}`);
  } else {
    params.push(creatorId);
    where.push(`id = $${params.length}`);
  }
}

const sql = `
  SELECT id, name, role, client_id
  FROM public.vw_equipe
  WHERE ${where.join(" AND ")}
`;
const users = await externalRaw(sql, params);
```

Remover toda a lógica antiga de `u.is_active`, `u.user_id`, `u.client_id IS NULL/NOT NULL` — a view já encapsula essas regras.

## Sem mudanças em
- UI de criação (`/notificar-clientes`)
- `NotificationCenter`
- Schema do banco interno

## Validação
1. Reprocessar a última notificação com `audience=owners` → `recipients_total` = nº de linhas com `user_funcao='dono'` em `vw_equipe`.
2. Criar notificação `audience=teams` → recebe apenas `user_funcao='equipe'`.
3. Criar `audience=all` → recebe todos da Nova Júlia (donos + equipes).
4. Confirmar que usuários da plataforma antiga (ausentes da view) ficam fora.
