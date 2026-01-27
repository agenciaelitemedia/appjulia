
## Tratamento do campo `settings` como JSONB

### Contexto do problema
O campo `settings` da tabela `agents` deveria ser armazenado como JSONB, mas está sendo salvo como texto literal (string com `\n` escapados). Isso causa:
- Dados salvos incorretamente no banco
- Erro `[object Object]` ao editar (quando JSONB é lido como objeto)
- Erro React #31 ao visualizar (tentativa de renderizar objeto como texto)

### Causa raiz
O PostgreSQL está recebendo a string JSON e salvando-a como texto em vez de parseá-la para JSONB. Além disso, o frontend não trata corretamente quando o dado retorna como objeto JavaScript (comportamento esperado do JSONB).

---

## Mudanças a implementar

### 1. Edge Function - Forçar cast para JSONB no INSERT

**Arquivo:** `supabase/functions/db-query/index.ts`

**Ação `insert_agent` (linha ~492):**
Alterar o INSERT para incluir cast explícito `::jsonb`:

```sql
INSERT INTO agents (client_id, cod_agent, settings, prompt, ...)
VALUES ($1, $2, $3::jsonb, $4, ...)
```

Isso garante que o PostgreSQL interprete a string como JSON e armazene no formato JSONB.

---

### 2. Edge Function - Forçar cast para JSONB no UPDATE

**Arquivo:** `supabase/functions/db-query/index.ts`

**Ação `update_agent` (linha ~612):**
Alterar o UPDATE para incluir cast explícito:

```sql
UPDATE agents 
SET settings = $1::jsonb, prompt = $2, ...
```

---

### 3. Frontend - Tratar `settings` no carregamento (Edição)

**Arquivo:** `src/pages/agents/EditAgentPage.tsx`

**Problema:** Linha 138 assume que `data.settings` é sempre string, mas quando vem de JSONB, é um objeto.

**Solução:** Converter para string se for objeto:

```typescript
// Linha 138 - Ao popular o formulário
config_json: typeof data.settings === 'object' 
  ? JSON.stringify(data.settings, null, 2) 
  : (data.settings || '{}'),
```

---

### 4. Frontend - Tratar `settings` na visualização (Detalhes)

**Arquivo:** `src/pages/agents/AgentDetailsPage.tsx`

**Problema:** `formatJsonSettings()` (linhas 103-109) tenta fazer `JSON.parse()` em algo que já pode ser objeto.

**Solução:** Verificar o tipo antes de processar:

```typescript
const formatJsonSettings = () => {
  if (!details?.settings) return '{}';
  
  // Se já é objeto (JSONB), formatar diretamente
  if (typeof details.settings === 'object') {
    return JSON.stringify(details.settings, null, 2);
  }
  
  // Se é string, tentar parsear
  try {
    return JSON.stringify(JSON.parse(details.settings), null, 2);
  } catch {
    return details.settings;
  }
};
```

---

### 5. Atualizar a interface TypeScript

**Arquivos:** `EditAgentPage.tsx` e `AgentDetailsPage.tsx`

**Problema:** A interface `AgentDetails` define `settings: string`, mas após as correções, pode vir como objeto.

**Solução:** Alterar o tipo para aceitar ambos:

```typescript
settings: string | Record<string, unknown>;
```

---

## Resumo das alterações por arquivo

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/db-query/index.ts` | Cast `::jsonb` em `insert_agent` e `update_agent` |
| `src/pages/agents/EditAgentPage.tsx` | Converter objeto para string ao carregar; ajustar interface |
| `src/pages/agents/AgentDetailsPage.tsx` | Tratar objeto e string em `formatJsonSettings`; ajustar interface |

---

## Resultado esperado

Após implementação:
- Novo agente: `settings` será salvo como JSONB real no banco
- Editar agente: Carrega corretamente independente do formato existente
- Visualizar agente: Exibe JSON formatado sem erros
- Dados antigos (texto): Continuam funcionando (fallback para string)
