# Plano: `n8n_execute-agent_and_followup-reactive`

Reativa a Julia (sessão do agent) e agenda um pré-followup para o lead, garantindo que não sobre nenhum followup ativo/pré antigo.

## 1. Nova action no `db-query` — `agent_and_followup_reactive`

Arquivo: `supabase/functions/db-query/index.ts` (novo `case` junto do `followup_stop`).

**Input (`data`):**

- `codAgent: string` (obrigatório)
- `phones: string[]` — variantes 13/12 dígitos geradas pela edge function
- `whatsappNumberInsert: string` — número canônico único a inserir no temp (13 díg p/ DDD<30, 12 díg p/ DDD>=30), resolvido na edge function
- `hubFila: 'uazapi' | 'waba'` (obrigatório)

**Passos (única transação `sql.begin`):**

1. **Buscar session mais recente** (também valida existência):
  ```sql
   SELECT 'SessionID_' || a.cod_agent || '-' || s.whatsapp_number || '_' || s.id AS chat_memory,
          a.id AS agent_id, s.id AS session_id
   FROM public.sessions s
   INNER JOIN public.agents a ON a.id = s.agent_id
   WHERE a.cod_agent = $1::bigint
     AND s.whatsapp_number = ANY($2::bigint[])
   ORDER BY s.id DESC LIMIT 1
  ```
   Se vazio → erro `sessão não encontrada`.
2. **Limpar followups pendentes** (mesma lógica do `followup_stop`, mas sem mexer em `agent_processing_status`):
  ```sql
   UPDATE public.followup_queue
      SET "state" = 'STOP', send_date = now()
    WHERE name_client = $1 AND session_id = ANY($2::text[]) AND "state" = 'SEND';

   DELETE FROM public.followup_queue_temp
    WHERE cod_agent = $1::bigint AND session_id = ANY($2::bigint[]);
  ```
3. **Inserir novo pré-followup** (uma única linha):
  ```sql
   INSERT INTO public.followup_queue_temp (session_id, cod_agent, created_at, hub, chat_memory)
   VALUES ($1::bigint, $2::bigint, now(), $3, $4);
  ```
4. **Reativar sessão**:
  ```sql
   UPDATE public.sessions SET active = TRUE WHERE id = $1;
  ```

**Retorno:**

```json
{
  "session_id": 123,
  "agent_id": 45,
  "chat_memory": "SessionID_202605012-5511970558345_371706",
  "inserted_temp": 1,
  "updated_queue": N,
  "deleted_temp": N,
  "session_activated": true
}
```

## 2. Nova Edge Function `n8n_execute-agent_and_followup-reactive`

Arquivo: `supabase/functions/n8n_execute-agent_and_followup-reactive/index.ts`

Espelha o padrão de `n8n_execute-followup-stop`:

- Body: `{ codAgent, whatsappNumber, hubFila }`
- Validação:
  - `codAgent`, `whatsappNumber`, `hubFila` obrigatórios
  - `hubFila ∈ ['uazapi','waba']`
- Normalização:
  - `phones = brPhoneVariants(whatsappNumber)` (13 + 12 díg)
  - `whatsappNumberInsert`: aplica regra do DDD
    - Extrair DDD de `normalizeBrPhone` → posição 2-4
    - Se DDD < 30 → 13 díg (com o 9º dígito)
    - Se DDD ≥ 30 → 12 díg (sem o 9º)
    - Números não-BR: usa como veio
- Chama `db-query` com action `agent_and_followup_reactive`
- Envelope de resposta `{ data, error }` idêntico ao followup-stop

### Helper novo em `_shared/phone-normalize.ts`

Adicionar `toBrCanonicalByDDD(raw)` que retorna o formato "real" pelo DDD (13 se <30, 12 se ≥30). Reutiliza a normalização base.

## 3. Config (se necessário)

Se `supabase/config.toml` tiver bloco para `n8n_execute-followup-stop`, replicar para a nova função (mesmo `verify_jwt`). Verificar antes; provavelmente já é o default.

## 4. Documentação

### `supabase/functions/n8n_execute/README.md`

Adicionar seção **"2) Agent & Followup Reactive"** com parâmetros, tabelas afetadas, exemplo de invocação e retorno.

### `supabase/functions/db-query/ACTIONS.md`

Regenerar via `node scripts/generate-db-query-actions-doc.mjs > ...`.

## 5. Memórias

Criar em `mem/features/n8n-execute/`:

- `**index.md**` — visão geral do grupo, convenções (nome de function, envelope, uso obrigatório de `db-query`, normalização BR compartilhada) e lista de funções.
- `**followup-stop.md**` — documenta a função já existente (parâmetros, tabelas, comportamento) — retroativo, pois não havia memória.
- `**agent-and-followup-reactive.md**` — documenta a nova função: propósito, parâmetros, regra do DDD para `whatsappNumberInsert`, SQL executado, ordem transacional, retorno.

Atualizar `mem/index.md`:

- Já existe entrada `[n8n Execute](mem://features/n8n-execute/index)` — adicionar linha citando `agent-and-followup-reactive` na descrição, ou apenas manter o index apontando (o próprio `index.md` do grupo lista as funções).

## Notas técnicas

- Reutilizar `brPhoneVariants` para geração de variantes (mesmo padrão do followup-stop).
- `codAgent`/`session_id` como `bigint` conforme regra `mem://technical/database/bigint-casting`.
- Não executar sem transação: se o INSERT falhar, o UPDATE de session não deve ocorrer → envolver em `sql.begin(async tx => { ... })`.
- Não chama `agent_processing_status` (essa tabela é limpa só no `followup_stop`, aqui a intenção é o oposto: reativar).