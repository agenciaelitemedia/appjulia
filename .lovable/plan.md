

## Plano: Navegar para o CRM filtrando por WhatsApp sem restrição de data

### Problema atual
1. `CampanhasLeadsTab` navega para `/crm/leads?search=whatsapp` mas o CRM **não lê** os query params da URL
2. A query do CRM **sempre filtra por data** (`stage_entered_at` entre `dateFrom` e `dateTo`), então mesmo buscando pelo número, o lead pode não aparecer se estiver fora do período selecionado

### Mudanças

**1. `src/pages/estrategico/campanhas/components/CampanhasLeadsTab.tsx`**
- Alterar `handleGoToCRM` para passar um parâmetro extra indicando busca por WhatsApp: `navigate(/crm/leads?whatsapp=NUMERO)`

**2. `src/pages/crm/CRMPage.tsx`**
- Importar `useSearchParams` do react-router-dom
- Na inicialização, verificar se existe `?whatsapp=` na URL
- Se existir: setar `filters.search` com o número, e limpar `dateFrom`/`dateTo` (strings vazias) para ignorar o filtro de data
- Limpar o param da URL após consumir (para não persistir no reload)

**3. `src/pages/crm/hooks/useCRMData.ts` — `useCRMCards`**
- Tornar os filtros de data **condicionais** na query SQL: se `dateFrom` e `dateTo` forem vazios, não aplicar a cláusula `WHERE` de data
- Isso permite buscar o lead independentemente de quando foi movimentado

### Resultado
Ao clicar "Ir para o CRM" na lista de leads da campanha, o usuário será redirecionado ao CRM com o número de WhatsApp preenchido na busca e sem filtro de data, garantindo que o lead apareça.

