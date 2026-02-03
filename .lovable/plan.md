
## Diagnóstico (confirmado com evidência)

O problema **não é “só visual”**: no banco externo, os campos `step_cadence`, `msg_cadence`, `title_cadence` estão **armazenados como JSONB do tipo `string`** (ou seja, um JSONB que contém uma string com JSON dentro).

Eu confirmei isso executando no backend:

- `jsonb_typeof(step_cadence)` retornou **"string"** para `cod_agent = 202602001`
- E também ficou claro que **`$1::jsonb` com parâmetro string vira `jsonb` do tipo string**, enquanto o literal `'{...}'::jsonb` vira **object**.

Isso acontece porque o driver usado no backend (`postgresjs`) trata **strings enviadas como parâmetro** como **“string JSON”** quando você faz `::jsonb`, então o Postgres recebe algo equivalente a `"{"cadence_1":"5 minutes"}"` (com aspas externas), e isso vira `jsonb_typeof = 'string'`.

Em resumo: **mesmo com `::jsonb`, se você passar string no parâmetro, ele vira JSONB string**. Para virar JSONB object, o parâmetro precisa ser um **objeto JS** (ou um mecanismo que force “raw JSON”).

---

## Objetivo da correção “de uma vez por todas”

1) Garantir que **novos saves** nunca mais gravem JSONB string  
2) Garantir que mesmo se chegar dado corrompido (string/double-string), o app **normalize e salve como objeto**  
3) Criar um caminho para **corrigir dados já corrompidos** no banco externo (massa)

---

## Mudanças propostas (código)

### 1) Parar de usar `JSON.stringify()` para enviar JSONB no save
**Arquivo:** `src/pages/agente/hooks/useFollowupData.ts`

- Trocar os params dos campos JSONB de:
  - `JSON.stringify(config.step_cadence || {})`
  para:
  - `coerceJsonbObject(config.step_cadence, {})` (retornando um objeto JS)
- E manter o SQL usando `::jsonb` (pode manter como redundância de tipagem)

**Por quê:** passando **objeto JS** no parâmetro, o driver envia como JSON real e o Postgres armazena como **JSONB object**.

---

### 2) Criar uma função de normalização “anti-regressão”
**Arquivo:** `src/pages/agente/hooks/useFollowupData.ts` (local, para não espalhar lógica)

Implementar helper tipo:

- Entrada: `unknown`
- Se for `object` e não-array: retorna como objeto
- Se for `string`: tenta `JSON.parse` em loop até 2–3 vezes:
  - Caso `JSON.parse` resulte em string novamente (caso `"\"{...}\""`), tenta de novo
  - Se resultar em objeto, ok
- Se falhar: retorna default `{}` (ou lança erro dependendo da estratégia)

Isso cobre:
- objeto correto `{ cadence_1: "5 minutes" }`
- string de objeto `'{"cadence_1":"5 minutes"}'`
- double-string `'"{\\"cadence_1\\":\\"5 minutes\\"}"'`

---

### 3) “Cinto e suspensório”: SQL que se auto-corrige se ainda chegar string
Mesmo após parar o stringify, eu vou deixar o SQL mais robusto para nunca mais cair nisso.

**UPDATE**:
- Substituir `step_cadence = $2::jsonb` por:
  - `step_cadence = CASE WHEN jsonb_typeof($2::jsonb) = 'string' THEN ($2::jsonb #>> '{}')::jsonb ELSE $2::jsonb END`
(e o mesmo para `msg_cadence` e `title_cadence`)

**INSERT**:
- Fazer o mesmo dentro do `VALUES (...)` usando `CASE WHEN ...`

Isso garante que:
- Se por algum motivo o parâmetro vier como string JSON, ele é “desembrulhado” e gravado como objeto.

---

### 4) Ajustar o parse no frontend para não “recontaminar” o save
Hoje o `parseJsonField()` (em `FollowupConfig.tsx` e `FollowupPage.tsx`) faz apenas 1 `JSON.parse`.  
Se o banco estiver corrompido como JSONB string, **um parse pode virar string novamente**.

Vamos melhorar a função para:
- tentar parse múltiplas vezes (máximo 2–3)
- garantir que retorna objeto (senão default)

Assim, mesmo lendo lixo, a UI sempre trabalha com objeto correto e o save não volta a contaminar.

---

## Correção dos dados já corrompidos (banco externo)

Mesmo com a correção no app, os registros antigos continuarão quebrando outros sistemas até serem corrigidos.

Vou te passar uma query de “repair” para rodar no banco externo (uma vez):

```sql
UPDATE followup_config
SET
  step_cadence  = CASE WHEN jsonb_typeof(step_cadence)  = 'string' THEN (step_cadence  #>> '{}')::jsonb ELSE step_cadence  END,
  msg_cadence   = CASE WHEN jsonb_typeof(msg_cadence)   = 'string' THEN (msg_cadence   #>> '{}')::jsonb ELSE msg_cadence   END,
  title_cadence = CASE WHEN jsonb_typeof(title_cadence) = 'string' THEN (title_cadence #>> '{}')::jsonb ELSE title_cadence END
WHERE
  jsonb_typeof(step_cadence)  = 'string'
  OR jsonb_typeof(msg_cadence) = 'string'
  OR jsonb_typeof(title_cadence) = 'string';
```

Depois disso, validar:

```sql
SELECT
  cod_agent,
  jsonb_typeof(step_cadence)  AS step_type,
  jsonb_typeof(msg_cadence)   AS msg_type,
  jsonb_typeof(title_cadence) AS title_type
FROM followup_config
WHERE cod_agent = '202602001';
```

Esperado: tudo **object**.

---

## Prevenção extra (opcional, nível banco — “nunca mais entra lixo”)

Se você tiver governança do schema do banco externo, dá para bloquear isso para sempre adicionando constraints:

1) Primeiro roda a query de repair acima (senão vai falhar)
2) Depois cria constraints:

```sql
ALTER TABLE followup_config
  ADD CONSTRAINT followup_config_step_cadence_is_object
  CHECK (jsonb_typeof(step_cadence) = 'object');

ALTER TABLE followup_config
  ADD CONSTRAINT followup_config_msg_cadence_is_object
  CHECK (jsonb_typeof(msg_cadence) = 'object');

ALTER TABLE followup_config
  ADD CONSTRAINT followup_config_title_cadence_is_object
  CHECK (jsonb_typeof(title_cadence) = 'object');
```

Isso faz qualquer tentativa de gravar JSONB string falhar imediatamente, protegendo todos os sistemas.

---

## Testes / validação após implementar

1) Na tela `/agente/followup` → aba Configurações → Salvar
2) Verificar via query:
   - `jsonb_typeof(step_cadence)` deve ser `object`
3) Verificar que o payload de save (DebugBar/Network) agora envia **objeto** (não string) nos params do `db-query`

---

## Arquivos envolvidos

- `src/pages/agente/hooks/useFollowupData.ts`
  - parar `JSON.stringify` nos params JSONB
  - adicionar normalização
  - reforçar SQL com `CASE WHEN jsonb_typeof(...) = 'string' ...`
- `src/pages/agente/followup/components/FollowupConfig.tsx`
  - parse robusto (multi-parse)
- `src/pages/agente/followup/FollowupPage.tsx`
  - parse robusto (multi-parse) para consistência

---

## Resultado esperado

- A partir do deploy, **não grava mais JSONB string** mesmo que venha input “estranho”
- Ao salvar uma vez uma configuração corrompida, ela passa a ser gravada como **objeto**
- Com a query de repair, todos os registros antigos ficam consistentes e os “outros sistemas” param de quebrar
