

## Corrigir resolução de `client_id` para usuários vinculados (sub-usuários)

### Problema

Quando um usuário (membro de equipe) não tem `client_id` próprio mas está vinculado a um usuário principal via `user_id`, o sistema não está herdando o `client_id` do principal. Resultado: `useQueues` retorna lista vazia mesmo havendo filas cadastradas para o cliente correto.

A herança **já foi adicionada no `login`** (último diff em `db-query/index.ts`), mas:
1. O build está quebrado (`npm:bcryptjs@2.4.3` não resolve).
2. A herança só acontece no momento do login. Se o usuário já estava logado, o `client_id` em sessão continua nulo.
3. Outros pontos do código que resolvem `client_id` (ex.: `resolveClientId` em `useQueues.ts`) não fazem fallback via principal.

### Correções

**1. `supabase/functions/db-query/index.ts` — corrigir build**

O erro é `npm:bcryptjs@2.4.3` não encontrado. Trocar import para versão estável compatível com edge-runtime:
```ts
import bcrypt from "npm:bcryptjs@2.4.3";
```
→ trocar por:
```ts
import bcrypt from "https://esm.sh/bcryptjs@2.4.3";
```
(ou remover `deno.lock` se ele estiver causando conflito — já documentado em `useful-context`).

A query do `login` com `COALESCE(u.client_id, parent.client_id)` permanece como está no diff — está correta.

**2. `src/lib/externalDb.ts` — novo helper `getEffectiveClientId`**

Adicionar action no edge function `db-query`:
```sql
SELECT COALESCE(u.client_id, parent.client_id) AS client_id
  FROM users u
  LEFT JOIN users parent ON parent.id = u.user_id
 WHERE u.id = $1
```
Expor como `externalDb.getEffectiveClientId(userId)`.

**3. `src/pages/agente/filas/hooks/useQueues.ts` — usar herança**

Atualizar `resolveClientId`:
```ts
async function resolveClientId(user) {
  if (user?.client_id) return String(user.client_id);
  if (!user?.id) return null;
  // 1º fallback: herdar do usuário principal (user_id)
  const inherited = await externalDb.getEffectiveClientId(Number(user.id));
  if (inherited) return String(inherited);
  // 2º fallback (legado): via user_agents → agents.client_id
  try {
    const userAgents = await externalDb.getUserAgents(Number(user.id));
    const found = userAgents?.find(a => a?.client_id != null);
    return found?.client_id ? String(found.client_id) : null;
  } catch { return null; }
}
```

**4. Forçar refresh da sessão**

Para usuários já logados pegarem o novo `client_id` herdado sem precisar deslogar, o `AuthContext` deve, no boot, revalidar `client_id` via `getEffectiveClientId` quando `user.client_id` estiver nulo mas `user.user_id` existir, e atualizar o estado/localStorage.

### Arquivos editados

- `supabase/functions/db-query/index.ts` — corrigir import bcryptjs; adicionar action `get_effective_client_id`.
- `src/lib/externalDb.ts` — adicionar `getEffectiveClientId(userId)`.
- `src/pages/agente/filas/hooks/useQueues.ts` — usar herança via principal antes do fallback `user_agents`.
- `src/contexts/AuthContext.tsx` — no boot, se `user.client_id` for nulo e `user.user_id` existir, hidratar `client_id` herdado.

### Resultado

- Filas (e qualquer outro recurso vinculado a `client_id`) passam a funcionar para sub-usuários (membros de equipe/advogados/comerciais) sem `client_id` próprio, herdando do principal.
- Não exige backfill no banco — a herança é resolvida em runtime.
- Filas sem agentes vinculados continuam aparecendo normalmente (não há mudança nessa parte).

