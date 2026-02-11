

## Correção dos Funis de Campanhas no Dashboard

### Problema identificado

A query do funil de campanhas (`useDashboardCampaignFunnel`) tem dois bugs:

### Bug 1 - Mapeamento trocado (causa principal dos dados errados)

No bloco final `UNION ALL` (linhas 182-187), os CTEs estao atribuidos as posicoes erradas:

- Posicao 3 ("Contratos Gerados") esta usando o CTE `qualificados` em vez de `contratos_gerados`
- Posicao 4 ("Contratos Assinados") esta usando o CTE `contratos_gerados` em vez de `contratos_assinados`
- O CTE `contratos_assinados` nunca e utilizado

Isso faz com que o valor de "Qualificados" (maior) apareca como "Contratos Gerados", gerando numeros inflados e maiores que o total da Julia.

### Bug 2 - Contagem inconsistente

O funil Julia conta `COUNT(DISTINCT whatsapp)` para atendimentos, mas o de campanhas usa `COUNT(*)` sobre registros com DISTINCT por `ca.id`. Um mesmo whatsapp pode ter multiplos registros de campanha, inflando a entrada.

### Correcao

Arquivo: `src/pages/dashboard/hooks/useDashboardFunnels.ts`

Alterar o bloco UNION ALL final (linhas 182-187) para mapear corretamente:

```sql
SELECT 'Atendimentos' ..., (SELECT count FROM entrada)
UNION ALL SELECT 'Em Qualificação' ..., (SELECT count FROM atendidos)
UNION ALL SELECT 'Qualificados' ..., (SELECT count FROM em_qualificacao)
UNION ALL SELECT 'Contratos Gerados' ..., (SELECT count FROM contratos_gerados)    -- era qualificados
UNION ALL SELECT 'Contratos Assinados' ..., (SELECT count FROM contratos_assinados) -- era contratos_gerados
```

Tambem alterar a CTE `entrada` para usar `COUNT(DISTINCT whatsapp)` em vez de `COUNT(*)`, garantindo consistencia com o funil Julia e evitando duplicatas por multiplos registros do mesmo whatsapp.

Alem disso, adicionar filtro `WHERE whatsapp IS NOT NULL` na CTE `campaign_leads` para evitar que registros sem telefone inflem as contagens nos JOINs com CRM.

