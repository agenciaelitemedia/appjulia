

# Análise da Divergência de Contratos (11 vs 10 vs 9)

## Diagnóstico

Cada local usa uma **fonte de dados diferente** para contar contratos:

| Local | Fonte | Filtro de Data | Resultado |
|---|---|---|---|
| **Contratos Julia (11)** | `vw_painelv2_desempenho_julia_contratos` | `data_contrato` | Conta contratos reais gerados pela Julia |
| **Dashboard Card (10)** | `crm_atendimento_cards` + stages `IN ('Contrato em Curso', 'Contrato Assinado')` | `stage_entered_at` | Conta leads no CRM que estão em estágios de contrato — pode faltar 1 se o lead ainda não foi movido no CRM ou se `stage_entered_at` difere de `data_contrato` |
| **Funil Julia (9)** | `crm_atendimento_cards` filtrados por match de WhatsApp com `vw_painelv2_desempenho_julia` | `stage_entered_at` no CRM | Faz JOIN por WhatsApp entre CRM e Julia — falha se o número do lead no CRM não bate exatamente com o número na view Julia (formatação diferente, sem DDI, etc.) |

### Causas raiz:
1. **Card Dashboard vs Contratos**: usa tabela CRM (`crm_atendimento_cards`) em vez da view de contratos Julia. Se 1 contrato foi gerado pela Julia mas o lead no CRM ainda não está no estágio correto ou `stage_entered_at` cai fora do range, perde 1.
2. **Funil vs Card**: o funil filtra adicionalmente por `EXISTS` matching WhatsApp entre CRM e Julia. Se 2 leads têm números formatados diferente (ex: `5511...` vs `11...`), o match falha e perde 2.

## Solução

Unificar as 3 contagens para usar a **mesma fonte**: `vw_painelv2_desempenho_julia_contratos`.

### 1. Dashboard Card — `useDashboardStats` (conversions)
Trocar a query de conversions (linhas 162-173) de:
```sql
SELECT COUNT(*) FROM crm_atendimento_cards c 
JOIN crm_atendimento_stages s ON c.stage_id = s.id 
WHERE s.name IN ('Contrato em Curso', 'Contrato Assinado')
```
Para:
```sql
SELECT COUNT(*) as count
FROM vw_painelv2_desempenho_julia_contratos
WHERE cod_agent::text = ANY($1::varchar[])
  AND (data_contrato AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
  AND (data_contrato AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
```
Isso garante que o card "Contratos Gerados/Assinados" mostre 11, igual à página de contratos.

### 2. Funil Julia — `useDashboardJuliaFunnel` (contratos_gerados e contratos_assinados)
Trocar os CTEs `contratos_gerados` e `contratos_assinados` (linhas 85-96) de contar `julia_leads` no CRM para contar diretamente da view Julia:
```sql
contratos_gerados AS (
  SELECT COUNT(*)::int as count
  FROM vw_painelv2_desempenho_julia_contratos
  WHERE cod_agent::text = ANY($1::varchar[])
    AND (data_contrato AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
    AND (data_contrato AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
),
contratos_assinados AS (
  SELECT COUNT(*)::int as count
  FROM vw_painelv2_desempenho_julia_contratos
  WHERE cod_agent::text = ANY($1::varchar[])
    AND (data_contrato AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
    AND (data_contrato AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
    AND status_document = 'SIGNED'
)
```

### 3. Dashboard Stats Previous — mesma mudança para comparação
Trocar a query de `conversionsResult` no `useDashboardStatsPrevious` para usar a view de contratos Julia com o período anterior.

### 4. Funil Campanhas — `useDashboardCampaignFunnel`
Aplicar a mesma lógica: contar contratos da view Julia que possuem match com `campaing_ads`.

## Arquivos alterados
| Arquivo | Ação |
|---|---|
| `src/pages/dashboard/hooks/useDashboardData.ts` | Trocar queries de conversions (stats + statsPrevious) para usar view de contratos Julia |
| `src/pages/dashboard/hooks/useDashboardFunnels.ts` | Trocar CTEs contratos_gerados e contratos_assinados para usar view de contratos Julia |

