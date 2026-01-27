
# Plano: Corrigir Gravacao de Settings como JSONB

## Problema Identificado

O campo `settings` esta sendo gravado como **TEXT** em vez de **JSONB**. Ao consultar o banco, o valor retorna como string escapada:

```json
"settings": "{\n  \"CHAT_RESUME\": true,\n  ..."
```

Quando deveria retornar como objeto:

```json
"settings": { "CHAT_RESUME": true, ... }
```

### Causa Raiz

O cast `$1::jsonb` no PostgreSQL funciona, mas ha dois problemas:

1. **Na leitura**: O campo esta vindo do banco ja como string (indicando que pode ter sido gravado incorretamente antes)
2. **Na gravacao**: O JSON formatado com `\n` pode causar problemas de interpretacao

## Solucao

### 1. Modificar a Acao `update_agent` na Edge Function

Garantir que o settings seja parseado e re-serializado antes de enviar ao banco, usando `JSON.parse()` e `JSON.stringify()` sem formatacao:

**Arquivo:** `supabase/functions/db-query/index.ts`

**Localizacao:** Linha 671-684

**Mudanca:**

```typescript
case 'update_agent': {
  const { agentId, agentData } = data;
  let { settings, prompt, is_closer, agent_plan_id, due_date, status } = agentData;
  
  // Garantir que settings seja um JSON valido sem formatacao
  try {
    const parsed = typeof settings === 'string' ? JSON.parse(settings) : settings;
    settings = JSON.stringify(parsed); // Remove formatacao \n e espacos
  } catch (e) {
    throw new Error('Settings JSON invalido');
  }
  
  const rows = await sql.unsafe(
    `UPDATE agents 
     SET settings = $1::jsonb, prompt = $2, is_closer = $3, 
         agent_plan_id = $4, due_date = $5, status = $6, updated_at = now()
     WHERE id = $7
     RETURNING *`,
    [settings, prompt, is_closer, agent_plan_id, due_date, status, agentId]
  );
  result = rows;
  break;
}
```

### 2. Modificar a Acao `insert_agent` (Para Consistencia)

Aplicar a mesma logica no INSERT para garantir que novos agentes tambem tenham settings como JSONB correto:

**Localizacao:** Linha 552-561

```typescript
case 'insert_agent': {
  let { client_id, cod_agent, settings, prompt, is_closer, agent_plan_id, due_date } = data;
  
  // Garantir que settings seja um JSON valido sem formatacao
  try {
    const parsed = typeof settings === 'string' ? JSON.parse(settings) : settings;
    settings = JSON.stringify(parsed);
  } catch (e) {
    throw new Error('Settings JSON invalido');
  }
  
  const rows = await sql.unsafe(
    `INSERT INTO agents (client_id, cod_agent, settings, prompt, is_closer, agent_plan_id, due_date, status, is_visibilided, created_at, updated_at)
     VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, true, true, now(), now())
     RETURNING id`,
    [client_id, cod_agent, settings, prompt, is_closer, agent_plan_id, due_date]
  );
  result = rows;
  break;
}
```

## Fluxo Corrigido

```text
1. Frontend envia: "{\n  \"CHAT_RESUME\": true\n}"
2. Edge Function: JSON.parse() -> { CHAT_RESUME: true }
3. Edge Function: JSON.stringify() -> "{\"CHAT_RESUME\":true}"
4. PostgreSQL: $1::jsonb -> JSONB { CHAT_RESUME: true }
5. Consulta retorna: { CHAT_RESUME: true } (objeto)
```

## Arquivos a Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `supabase/functions/db-query/index.ts` | Modificar | Normalizar settings em update_agent e insert_agent |

## Verificacao Apos Implementacao

Testar salvando um agente e consultando novamente. O campo `settings` deve retornar como objeto JSON, nao como string:

**Antes:**
```json
"settings": "{\n  \"CHAT_RESUME\": true }"
```

**Depois:**
```json
"settings": { "CHAT_RESUME": true }
```

## Observacao sobre Dados Existentes

Os dados ja gravados como TEXT precisarao ser corrigidos manualmente ou via script SQL:

```sql
UPDATE agents 
SET settings = settings::jsonb 
WHERE settings IS NOT NULL;
```

Isso pode ser feito diretamente no banco de dados externo.
