
# Plano: Corrigir Busca Processual DataJud

## Problema Identificado

A busca não está retornando resultados porque:

1. **Query Elasticsearch incorreta**: A implementação atual usa uma query `bool` com `should` e `wildcard`, mas a API DataJud espera uma query simples `match`
2. **Timeout insuficiente**: 15 segundos pode não ser suficiente para alguns tribunais mais lentos
3. **Formato do número**: A query deve usar o número do processo sem formatação (apenas dígitos), no formato correto

## Correções Necessárias

### 1. Edge Function - Query de Busca por Número

**Antes (incorreto):**
```json
{
  "bool": {
    "should": [
      { "match": { "numeroProcesso": "0001234-56.2024.8.26.0100" } },
      { "match": { "numeroProcesso": "00012345620248260100" } },
      { "wildcard": { "numeroProcesso": "*00012345620248260100*" } }
    ]
  }
}
```

**Depois (correto - conforme documentação oficial CNJ):**
```json
{
  "match": {
    "numeroProcesso": "00012345620248260100"
  }
}
```

### 2. Aumentar Timeout

- Aumentar timeout de 15s para 30s para acomodar tribunais mais lentos

### 3. Ajustar Query para Documentos (CNPJ)

A API DataJud não expõe dados de partes (CPF/CNPJ) devido à LGPD. Segundo a documentação:
> "Os dados fornecidos pela API são provenientes da Base Nacional de Dados do Poder Judiciário (Datajud), mas com a devida proteção aos processos sigilosos e **dados de partes**."

Portanto, a busca por CNPJ não funcionará na API pública. O sistema deve:
- Informar ao usuário que busca por CNPJ não é suportada pela API pública
- Ou remover essa opção

### 4. Ajustar Query para Advogado (OAB)

Similar ao CNPJ, dados de advogados não estão expostos na API pública.

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/datajud-search/index.ts` | Corrigir queries Elasticsearch, aumentar timeout |
| `src/pages/datajud/components/SearchTypeSelector.tsx` | Adicionar aviso sobre limitações |
| `src/pages/datajud/DataJudSearchPage.tsx` | Melhorar feedback ao usuário |

## Detalhes Técnicos

### Nova função buildProcessNumberQuery

```javascript
function buildProcessNumberQuery(processNumber: string) {
  // Remove toda formatação - API espera apenas dígitos
  const cleanNumber = processNumber.replace(/\D/g, "");
  return {
    match: {
      numeroProcesso: cleanNumber
    }
  };
}
```

### Timeout Aumentado

```javascript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s
```

### Tratamento para Buscas Não Suportadas

Para CNPJ e OAB, retornar mensagem informativa:
- "A busca por CNPJ não está disponível na API pública do DataJud devido às restrições da LGPD"
- "A busca por OAB não está disponível na API pública do DataJud"

Alternativa: permitir busca apenas por número do processo e remover as outras opções.

## Resultado Esperado

Após as correções:
1. Busca por número do processo funcionará corretamente
2. Usuário receberá feedback claro sobre limitações da API
3. Sistema mais robusto com timeout adequado
