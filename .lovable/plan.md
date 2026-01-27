
## Objetivo
Garantir que o campo `agents.settings` seja **JSONB do tipo “object”** (não “string”) e que a API retorne esse campo como **objeto JSON**, mantendo compatibilidade com outros sistemas.

## O que eu já confirmei (com consultas diretas no backend)
- A coluna `settings` **é do tipo `jsonb`** no banco (`information_schema.columns`).
- Para o agente `id=297`, o valor atual no banco **já está como objeto JSONB** (quando consultado diretamente), e o `get_agent_details` também **já pode retornar como objeto**.

Isso indica que o problema que você está vendo geralmente acontece por um destes motivos:
1) **Settings “duplamente serializado”** chegando no backend (vira `JSONB string`, exemplo: `"\"{...}\""`), e aí fica salvo como string dentro do JSONB.  
2) **Registros antigos corrompidos** (já existentes) onde `jsonb_typeof(settings) = 'string'`.  
3) Algum endpoint/consulta que faça cast para texto (ex.: `settings::text`) — não é o caso do `get_agent_details` atualmente, mas pode existir em outros endpoints/relatórios.

## Mudanças propostas (para resolver “de vez”)

### 1) Blindagem no salvamento (insert/update) contra “JSON duplamente stringificado”
**Problema:** se o frontend (ou outro sistema) mandar `settings` como string já “stringificada de novo”, o `JSON.parse()` retorna **string**, não objeto, e hoje isso pode passar e acabar salvando `jsonb` como string.

**Solução:** criar uma função interna `normalizeSettings()` na função `db-query` que:
- Aceita `settings` como `unknown`
- Se for string: faz `JSON.parse()`
- Se o resultado ainda for string: faz `JSON.parse()` de novo (uma segunda etapa)
- No final, valida que o resultado é um **objeto plain** (não string, não array, não null)
- Só então faz `JSON.stringify(obj)` para enviar ao SQL com `::jsonb`

Resultado: mesmo que chegue `"\"{...}\""`, a função converte para `{...}` antes de gravar.

### 2) Blindagem na leitura (garantir retorno como objeto)
Mesmo com a blindagem acima, pode existir legado.

**Solução:** em endpoints que retornam `settings` (pelo menos `get_agent_details` e qualquer outro que exponha settings), retornar:
- `CASE WHEN jsonb_typeof(a.settings) = 'string' THEN (a.settings #>> '{}')::jsonb ELSE a.settings END AS settings`

Isso faz com que, mesmo que algum registro esteja como JSONB string, a API devolva um objeto (e não uma string escapada).

### 3) Reparar registros antigos (migração de dados, sem depender de acesso externo)
Adicionar uma ação “controlada” no backend (ex.: `normalize_agents_settings`) que execute com segurança:
- **Pré-check:** `SELECT COUNT(*) FROM agents WHERE jsonb_typeof(settings)='string'`
- **Fix:** `UPDATE agents SET settings = (settings #>> '{}')::jsonb WHERE jsonb_typeof(settings)='string'`
- **Pós-check:** retorna quantos foram corrigidos

Isso remove o legado que pode estar quebrando “a outra aplicação”.

### 4) Validação/Diagnóstico (para você ver “preto no branco”)
Vou deixar preparado um diagnóstico que você (ou eu) pode rodar via backend:
- `SELECT jsonb_typeof(settings) AS t, COUNT(*) FROM agents GROUP BY 1;`
Assim a gente confirma se ainda existe `t='string'` em algum registro.

## Como vamos validar que ficou correto
1) Salvar um agente pela UI.
2) Recarregar os detalhes do agente.
3) Conferir que `settings` volta como objeto (sem aspas e sem escapes).
4) Rodar o diagnóstico e garantir que não existe mais `jsonb_typeof(settings)='string'`.

## Escopo de arquivos (quando eu voltar ao modo de implementação)
- `supabase/functions/db-query/index.ts`
  - Refatorar `insert_agent` e `update_agent` para usar `normalizeSettings()`
  - Ajustar retorno do `get_agent_details` (e revisar outros endpoints que retornem settings)
  - Adicionar ação segura de normalização em massa (opcional, mas recomendado)

## Observação importante (por que seu exemplo “com aspas” está errado)
O formato abaixo representa **um JSON string**, não um JSON object:
- `"{"CHAT_RESUME":true,...}"`

Outros sistemas que esperam JSONB object quebram porque isso vira `jsonb_typeof(settings)='string'`.
O correto é gravar como objeto:
- `{ "CHAT_RESUME": true, ... }`

Com as mudanças acima, vamos garantir que isso nunca mais aconteça, mesmo se algum cliente mandar o payload errado.

