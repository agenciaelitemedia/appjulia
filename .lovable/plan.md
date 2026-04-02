

# Correção dos Planos: Preços em Reais + Agrupamento por Período

## Mudanças

### 1. Admin `PlanosPage.tsx` — Entrada de preço em Reais (R$)

**Problema atual**: Os campos pedem valores em centavos, o que é confuso.

**Solução**: 
- Campos de preço aceitam valor em Reais (ex: `297.00`)
- Ao abrir para edição, divide o valor por 100 para exibir em Reais
- Ao salvar, multiplica por 100 para gravar em centavos no banco
- Remover campos redundantes (`price` base e `price_display`) — o `price` será calculado como o menor preço definido, e `price_display` será gerado automaticamente
- Na tabela de listagem, mostrar apenas os períodos que têm valor > 0

### 2. Checkout `PlanStep.tsx` — Mostrar só períodos com preço e agrupar

**Problema atual**: Sempre mostra os 3 períodos mesmo sem preço definido.

**Solução**:
- Detectar quais períodos têm pelo menos 1 plano com preço > 0
- Mostrar apenas as abas de períodos que existem
- Cada aba mostra o bloco de planos daquele período (só planos com preço > 0 naquele período)
- Se só 1 período tem preços, não mostra seletor — vai direto

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/pages/admin/planos/PlanosPage.tsx` | Campos em R$ com conversão automática para centavos ao salvar |
| `src/pages/comprar/steps/PlanStep.tsx` | Filtrar períodos disponíveis e agrupar planos por bloco |

