

# Correção: Membros com perfil "advogado" e "comercial" não aparecem na lista de equipes

## Causa raiz

Na edge function `db-query`, a action `get_team_members` filtra apenas `WHERE u.role = 'time'` (linhas 1050 e 1063). O usuário 180 tem role `'advogado'`, então é excluído da listagem.

## Correção

### `supabase/functions/db-query/index.ts`

Alterar o filtro de role nas queries de `get_team_members`:

- **Admin**: trocar `WHERE u.role = 'time'` por `WHERE u.role IN ('time', 'advogado', 'comercial')`
- **Non-admin**: trocar `WHERE u.user_id = $1 AND u.role = 'time'` por `WHERE u.user_id = $1 AND u.role IN ('time', 'advogado', 'comercial')`

Isso garante que todos os perfis de equipe (time, advogado, comercial) apareçam na lista.

## Arquivo alterado

| Arquivo | Mudança |
|---|---|
| `supabase/functions/db-query/index.ts` | Incluir roles `advogado` e `comercial` no filtro de `get_team_members` |

