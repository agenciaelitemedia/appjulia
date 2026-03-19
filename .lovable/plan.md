

## Plano: Corrigir BOOT_ERROR da Edge Function db-query

### Problema
A edge function `db-query` não está iniciando. O erro nos logs é:
```
The requested module 'npm:bcryptjs@2.4.3' does not provide an export named 'compare'
```

O pacote `bcryptjs@2.4.3` usa `module.exports` (CommonJS), então named imports `{ compare, hash }` não funcionam no Deno com o specifier `npm:`.

### Correção

**`supabase/functions/db-query/index.ts` (linha 3)**

Trocar o import de named exports para default import:

```typescript
import bcrypt from "npm:bcryptjs@2.4.3";
```

E substituir todas as chamadas de `compare(...)` por `bcrypt.compare(...)` e `hash(...)` por `bcrypt.hash(...)` no restante do arquivo.

### Resultado
A function voltará a iniciar corretamente e o CRM carregará os dados normalmente.

