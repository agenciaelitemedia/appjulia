# db-query

Edge Function que centraliza o acesso ao **banco PostgreSQL externo** (não Supabase).
Atua como gateway único: o frontend nunca fala direto com o banco externo — todas
as operações passam por aqui via `action` + `data`.

## Invocação

```ts
import { supabase } from "@/integrations/supabase/client";

const { data, error } = await supabase.functions.invoke("db-query", {
  body: { action: "<nome_da_action>", data: { /* payload */ } },
});
// data = { data: <result>, error: null } | { data: null, error: "<msg>" }
```

- **Envelope de resposta:** sempre `{ data, error }`. Status HTTP 200 mesmo em erro
  de domínio; verifique `error` antes de usar `data`.
- **HTTP 500** indica falha de runtime (action desconhecida, exception não tratada,
  banco indisponível). Cheque os logs com `supabase--edge_function_logs`.

## Contrato das actions

A lista completa de actions, payloads esperados e formato de retorno está em
[`ACTIONS.md`](./ACTIONS.md). Esse arquivo é **gerado automaticamente** a partir
do `index.ts` para evitar divergência entre código local e função publicada.

### Regenerar a doc

Sempre que adicionar/alterar uma action no `index.ts`, regenere:

```bash
node scripts/generate-db-query-actions-doc.mjs > supabase/functions/db-query/ACTIONS.md
```

E faça o redeploy explícito (Lovable redeploya em loop, mas para validar agora):

```
supabase--deploy_edge_functions(["db-query"])
```

## Convenções

- Toda nova action **deve** ter um `case '<nome>':` no switch principal e atribuir
  o resultado à variável `result` (single statement) — o gerador depende disso para
  detectar o retorno automaticamente.
- Inputs devem ser lidos como `data.<campo>` (ou `data?.<campo>`) ou via
  destructuring `const { x, y } = data`. O gerador captura esses padrões.
- Conexão PG segue `mem://technical/edge-functions/external-db-connection-logic`
  (postgresjs + detecção de socket Unix + normalização do CA SSL).
- Nunca aceitar SQL bruto vindo do cliente. Use queries parametrizadas com
  `sql.unsafe(query, params)`.