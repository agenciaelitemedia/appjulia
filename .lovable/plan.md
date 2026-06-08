# Por que `annabiaf8@outlook.com` não foi removida

## Diagnóstico

A ação `delete_team_member` na edge function `db-query` (linhas 1428-1445 de `supabase/functions/db-query/index.ts`) faz:

```sql
DELETE FROM user_agents WHERE user_id = $1;
DELETE FROM users WHERE id = $1 AND role IN ('time', 'advogado', 'comercial');
```

E em seguida retorna **sempre** `{ success: true }`, sem verificar quantas linhas foram afetadas.

Cenários que fazem a remoção falhar silenciosamente (UI mostra "Membro removido com sucesso!" mas o usuário continua na lista):

1. **Role fora da whitelist** — se `annabiaf8` tem role diferente de `time/advogado/comercial` (ex.: `principal`, `admin`, `gestor`, etc.), o `DELETE` não remove nada.
2. **FK bloqueando** — se houver outra tabela referenciando `users.id` sem `ON DELETE CASCADE` (ex.: `chat_*`, `crm_*`, `tasks`, `phone_*`), o `DELETE` lançaria erro — mas como o handler não está em try/catch dedicado, o erro pode estar sendo engolido em outro nível. (Menos provável dado o toast de sucesso.)
3. **Cache do React Query** — após sucesso só invalida `["team-members"]`, mas a view `vw_equipe` pode estar usando uma replicação/cache. (Pouco provável.)

A causa #1 é de longe a mais provável.

## Plano

### 1. Investigação rápida (read-only)
Consultar via `db-query` (action `raw`) qual é o `role` atual da usuária:
```sql
SELECT id, name, email, role, client_id, user_id, deleted_at
FROM users WHERE email = 'annabiaf8@outlook.com';
```
Com o resultado confirmamos o motivo exato e podemos checar dependências.

### 2. Corrigir a edge function `delete_team_member`
Em `supabase/functions/db-query/index.ts` (case `delete_team_member`):

- Trocar `sql.unsafe(...)` por tagged template com `RETURNING id` para saber se algo foi deletado.
- Validar via `SELECT role` antes; se o role não estiver na whitelist atual, decidir conforme passo 3.
- Retornar `{ success: false, reason: 'not_found_or_role_not_allowed' }` quando nada for removido (em vez de mentir `success: true`).
- Envolver em `try/catch` e devolver `{ success: false, reason: 'fk_violation', detail }` quando o Postgres reclamar de FK.

### 3. Ajustar a whitelist de roles
Dependendo do role real de annabiaf8 (passo 1), incluir o role na cláusula `WHERE role IN (...)` — desde que a usuária realmente pertença à equipe do solicitante via `client_id`.

Adicionar também checagem por `client_id` (o admin só pode remover membros do próprio `client_id`) para manter a segurança da operação.

### 4. Ajustar a camada frontend
Em `src/pages/equipe/hooks/useEquipeData.ts` → `useDeleteTeamMember`:

- Quando a edge function retornar `{ success: false, reason }`, lançar erro com mensagem amigável (ex.: "Não foi possível remover: o usuário possui dados vinculados" ou "Permissão insuficiente para esse cargo").
- Manter `invalidateQueries(["team-members"])` apenas no sucesso real.

## Observações

- Nada muda na UI do menu de conversas; o foco é exclusivamente o fluxo de exclusão de membros.
- Após a correção, conseguiremos remover `annabiaf8@outlook.com` (ou veremos a razão real impedindo).
