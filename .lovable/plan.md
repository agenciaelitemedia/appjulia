
# Plano: Corrigir Campos JSONB da Configuração de FollowUp

## Problema Identificado

Os campos JSONB (`step_cadence`, `msg_cadence`, `title_cadence`) da tabela `followup_config` estão sendo salvos como **strings de texto** em vez de **objetos JSON nativos**.

### Causa Raiz

No arquivo `src/pages/agente/hooks/useFollowupData.ts` (linhas 86-135), a query SQL recebe os valores como `JSON.stringify()`, mas **não aplica o cast `::jsonb`** explícito, fazendo o PostgreSQL interpretar como texto literal.

### Formato Incorreto (Atual)
```sql
step_cadence = $2  -- recebe: '{"cadence_1":"5 minutes"}'
                   -- PostgreSQL salva como: TEXT "{\"cadence_1\":\"5 minutes\"}"
```

### Formato Correto (Esperado)
```sql
step_cadence = $2::jsonb  -- recebe: '{"cadence_1":"5 minutes"}'
                          -- PostgreSQL salva como: JSONB {"cadence_1":"5 minutes"}
```

---

## Solução

Aplicar o cast `::jsonb` explícito em todas as queries que manipulam os campos JSONB da tabela `followup_config`.

---

## Arquivo a Modificar

**`src/pages/agente/hooks/useFollowupData.ts`**

### Mudanças na Query de UPDATE (linhas 86-112)

```typescript
// ANTES (incorreto):
return externalDb.raw({
  query: `
    UPDATE followup_config SET
      step_cadence = $2,
      msg_cadence = $3,
      title_cadence = $4,
      ...
  `,
  params: [
    config.cod_agent,
    JSON.stringify(config.step_cadence || {}),
    JSON.stringify(config.msg_cadence || {}),
    JSON.stringify(config.title_cadence || {}),
    ...
  ],
});

// DEPOIS (correto):
return externalDb.raw({
  query: `
    UPDATE followup_config SET
      step_cadence = $2::jsonb,
      msg_cadence = $3::jsonb,
      title_cadence = $4::jsonb,
      ...
  `,
  params: [
    config.cod_agent,
    JSON.stringify(config.step_cadence || {}),
    JSON.stringify(config.msg_cadence || {}),
    JSON.stringify(config.title_cadence || {}),
    ...
  ],
});
```

### Mudanças na Query de INSERT (linhas 115-134)

```typescript
// ANTES (incorreto):
return externalDb.raw({
  query: `
    INSERT INTO followup_config (
      cod_agent, step_cadence, msg_cadence, title_cadence, ...
    ) VALUES ($1, $2, $3, $4, ...)
  `,
  ...
});

// DEPOIS (correto):
return externalDb.raw({
  query: `
    INSERT INTO followup_config (
      cod_agent, step_cadence, msg_cadence, title_cadence, ...
    ) VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, ...)
  `,
  ...
});
```

---

## Resumo das Mudanças

| Query | Campo | Antes | Depois |
|-------|-------|-------|--------|
| UPDATE | step_cadence | `= $2` | `= $2::jsonb` |
| UPDATE | msg_cadence | `= $3` | `= $3::jsonb` |
| UPDATE | title_cadence | `= $4` | `= $4::jsonb` |
| INSERT | step_cadence | `$2` | `$2::jsonb` |
| INSERT | msg_cadence | `$3` | `$3::jsonb` |
| INSERT | title_cadence | `$4` | `$4::jsonb` |

---

## Prevenção Futura

O padrão estabelecido no código é:

1. **Frontend**: Sempre usar `JSON.stringify()` para converter objetos em strings JSON
2. **Query SQL**: Sempre usar `::jsonb` cast explícito para campos JSONB
3. **Edge Function**: O `db-query` já tem esse padrão para a tabela `agents` com o campo `settings`

Este padrão garante que o PostgreSQL interprete corretamente o valor como JSONB nativo, evitando que seja armazenado como texto literal.

---

## Ação Adicional Recomendada

Após a correção, pode ser necessário corrigir os dados já corrompidos no banco:

```sql
-- Query para corrigir dados existentes (executar no banco externo)
UPDATE followup_config
SET 
  step_cadence = (step_cadence #>> '{}')::jsonb,
  msg_cadence = (msg_cadence #>> '{}')::jsonb,
  title_cadence = (title_cadence #>> '{}')::jsonb
WHERE jsonb_typeof(step_cadence) = 'string'
   OR jsonb_typeof(msg_cadence) = 'string'
   OR jsonb_typeof(title_cadence) = 'string';
```

Essa query converte os valores que estão como strings de volta para objetos JSON nativos.
