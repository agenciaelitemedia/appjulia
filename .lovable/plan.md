
# Correção: Carregar Campos de Endereço no Perfil

## Problema Identificado

A consulta `get_client` na Edge Function não está selecionando os novos campos de endereço (`street`, `street_number`, `complement`, `neighborhood`). Por isso, quando a página carrega, esses campos aparecem vazios mesmo que tenham sido salvos anteriormente.

## Solução

Atualizar a query SELECT no caso `get_client` da Edge Function para incluir todos os campos de endereço.

---

## Alterações Necessárias

### 1. Atualizar Edge Function `db-query`

**Arquivo:** `supabase/functions/db-query/index.ts`

Modificar a query do `get_client` (linhas 274-280) para incluir os campos faltantes:

**De:**
```sql
SELECT id, name, business_name, federal_id, email, phone, 
       country, state, city, zip_code, photo, created_at, updated_at
FROM clients
```

**Para:**
```sql
SELECT id, name, business_name, federal_id, email, phone, 
       country, state, city, zip_code, street, street_number, 
       complement, neighborhood, photo, created_at, updated_at
FROM clients
```

---

## Resumo Técnico

| Item | Detalhes |
|------|----------|
| **Arquivo modificado** | `supabase/functions/db-query/index.ts` |
| **Ação** | Adicionar 4 colunas ao SELECT |
| **Colunas adicionadas** | `street`, `street_number`, `complement`, `neighborhood` |
| **Deploy necessário** | Sim (automático) |

---

## Resultado Esperado

Após a correção:
- Os campos de endereço serão carregados corretamente ao abrir a página de perfil
- Os dados salvos anteriormente aparecerão nos campos correspondentes
- O formulário exibirá os valores atuais do banco de dados
