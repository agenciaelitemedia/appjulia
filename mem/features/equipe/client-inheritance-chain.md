---
name: Herança de escritório em cadeia (equipe)
description: client_id do membro é resolvido subindo a cadeia de titulares (users.user_id) via fn_effective_client_id; vw_equipe e login usam essa função
type: feature
---
Um membro de equipe pode ser vinculado a outro membro (2+ níveis). A resolução
antiga de 1 nível (`COALESCE(u.client_id, p.client_id)`) devolvia NULL e o
usuário ficava fora da equipe do escritório (caso Júlia 430 → Charles 209 → Tell 21 → client 300).

- `public.fn_effective_client_id(bigint)` (banco externo, criada/garantida pelo `db-query`):
  recursiva por `users.user_id`, para no primeiro `client_id` não nulo, profundidade máx. 10.
- `vw_equipe` usa a função para `client_id` e para `user_funcao` (mantém coluna `user_funcao`,
  senão `CREATE OR REPLACE VIEW` falha com "cannot drop columns from view").
- `login`, `get_effective_client_id`, `get_team_by_client` usam a mesma função.
- `insert_team_member`/`update_team_member` resolvem o `client_id` no servidor a partir do titular.
- `get_principal_users` (admin) omite titulares sem escritório resolvido, evitando criar órfãos.
