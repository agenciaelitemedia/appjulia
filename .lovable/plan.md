

## Objetivo
Garantir que `agents.settings` seja **sempre JSONB do tipo objeto** (nunca string), corrigindo definitivamente o problema onde `SELECT settings->>'CONTRACT_SIGNED'` retorna `null`.

## Diagnóstico Confirmado
O registro mais recente (`id=297`, `created_at=2026-01-26...`) está com:
- `jsonb_typeof(settings) = 'string'` (ERRADO)
- `settings->>'CONTRACT_SIGNED' = null` (consequência)
- O valor está como `"\"{\\\"CHAT_RESUME\\\":true,...`" (JSON duplamente serializado dentro de JSONB string)

Enquanto registros anteriores estão corretos (`jsonb_typeof(settings)='object'` e `->>'CONTRACT_SIGNED'` retorna texto).

## Por que isso ainda acontece mesmo "com cast ::jsonb"
Hoje o `db-query` faz:
1. `normalizedSettings = normalizeSettings(settings)` (que retorna `JSON.stringify(obj)`)
2. `SET settings = $1::jsonb`

O problema: quando o payload chega já como string literal `"\"{...}\""`, o cast `::jsonb` interpreta isso como um **JSONB do tipo string**, não objeto. A correção "à prova de bala" é: **mesmo que chegue como jsonb string, o SQL converte e grava como objeto**.

## Mudanças Técnicas

### 1. Blindagem no nível do SQL (`insert_agent` e `update_agent`)
Alterar o SQL para converter automaticamente jsonb string para objeto:

```sql
-- Em vez de apenas: SET settings = $1::jsonb
-- Usar com CTE:
WITH s AS (SELECT $1::jsonb AS v)
UPDATE agents
SET settings = CASE
  WHEN jsonb_typeof(s.v) = 'string' THEN (s.v #>> '{}')::jsonb
  ELSE s.v
END
FROM s
WHERE id = $2
RETURNING *;
```

Para INSERT:
```sql
WITH s AS (SELECT $1::jsonb AS v)
INSERT INTO agents (client_id, cod_agent, settings, prompt, is_closer, agent_plan_id, due_date)
SELECT $2, $3, 
  CASE WHEN jsonb_typeof(s.v) = 'string' THEN (s.v #>> '{}')::jsonb ELSE s.v END,
  $4, $5, $6, $7
FROM s
RETURNING id;
```

Isso garante:
- Se chegar `{...}` → grava objeto
- Se chegar `"\"{...}\""` → converte e grava objeto
- Mesmo que a entrada venha "errada", o banco nunca mais fica com `jsonb_typeof(settings)='string'`

### 2. Blindagem nas ações genéricas `insert` e `update`
Para `table === 'agents'` com `settings`:
- Detectar `table === 'agents' && 'settings' in data`
- Aplicar mesma lógica de conversão com CASE
- Garantir cast explícito `::jsonb`

Resultado: não existe mais nenhum caminho no backend que consiga gravar `settings` como jsonb string.

### 3. Adicionar ações de diagnóstico
**`diagnose_latest_agents_settings`**:
```sql
SELECT 
  id,
  created_at,
  jsonb_typeof(settings) as t,
  settings ? 'CONTRACT_SIGNED' as has_key,
  settings->>'CONTRACT_SIGNED' as contract_signed
FROM agents 
ORDER BY created_at DESC 
LIMIT 5;
```

**`diagnose_db_identity`**:
```sql
SELECT 
  current_database() as db_name,
  current_schema() as schema_name,
  inet_server_addr() as server_addr,
  inet_server_port() as server_port;
```

### 4. Correção de registros existentes (`normalize_agents_settings`)
Melhorar a ação existente para:
- Contar quantos estão como string (pré-check)
- Converter todos para objeto:
```sql
UPDATE agents 
SET settings = (settings #>> '{}')::jsonb 
WHERE jsonb_typeof(settings) = 'string';
```
- Retornar IDs corrigidos (amostra) para auditoria

## Arquivo a Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/db-query/index.ts` | Modificar `insert_agent`, `update_agent`, ações genéricas `insert`/`update`, adicionar diagnósticos |

## Sequência de Execução
1. Implementar blindagem SQL em `insert_agent` (com CTE + CASE)
2. Implementar blindagem SQL em `update_agent` (com CTE + CASE)
3. Implementar blindagem nas ações genéricas `insert`/`update` para tabela `agents`
4. Adicionar ação `diagnose_latest_agents_settings`
5. Adicionar ação `diagnose_db_identity`
6. Melhorar retorno de `normalize_agents_settings` (incluir IDs corrigidos)
7. Deploy da função
8. Executar `normalize_agents_settings` para corrigir legado (incluindo registro 297)
9. Validar com as queries originais

## Validação (Critério de Aceite)
Após aplicar as mudanças:

1. Salvar um agente (criar e editar)
2. Rodar `diagnose_latest_agents_settings` e verificar:
   - `t = 'object'` para todos
   - `contract_signed` retorna texto (quando a chave existir)
3. Rodar no banco manualmente:
   ```sql
   SELECT settings->>'CONTRACT_SIGNED' FROM public.agents ORDER BY created_at DESC LIMIT 1;
   ```
   - Resultado deve ser o texto (não `null`)
4. Se ainda aparecer `null`, usar `diagnose_db_identity` para confirmar que é o mesmo banco

## Observação Importante
JSONB no Postgres não guarda formatação/indentação. O que importa é:
- `jsonb_typeof(settings) = 'object'`
- Operadores funcionarem (`->`, `->>`, `?`, etc.)

O formato "minificado" vs "bonitinho" é irrelevante — o que quebra é estar como jsonb string. Esta correção elimina isso completamente.

