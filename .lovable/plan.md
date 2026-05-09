# Plano para corrigir o erro definitivamente

## Objetivo
Eliminar o erro `operator does not exist: bigint = character varying` na função `db-query` sem ficar apenas apagando sintomas em pontos isolados.

## O que vou fazer
1. **Corrigir a origem real do erro nas consultas de contratos**
   - Ajustar as queries que usam `vw_painelv2_desempenho_julia_contratos`, porque a falha atual está vindo dessa view.
   - Padronizar as comparações de `cod_agent` e `whatsapp` para evitar mistura entre `bigint` e `varchar`.

2. **Aplicar a mesma correção em todos os pontos do app que dependem dessa view**
   - `CRM Builder` (contexto da deal/Júlia)
   - `CRM` (informações de contrato)
   - `Dashboard` (funis e contadores)
   - Outros hooks/páginas que consultam essa mesma view

3. **Blindar o acesso ao banco externo no `db-query`**
   - Revisar os trechos do edge function onde comparações com `cod_agent`, `session_id` e campos relacionados ainda podem depender de inferência de tipo.
   - Padronizar casts explícitos nos filtros mais sensíveis para impedir regressões.

4. **Validar com a requisição que hoje quebra**
   - Reproduzir a chamada com erro.
   - Confirmar que a resposta volta 200 e que a página deixa de cair com blank screen.

## Resultado esperado
- O `db-query` para de retornar 500.
- O card/contrato da Júlia volta a carregar normalmente.
- Dashboard e demais telas que usam a mesma view deixam de falhar pelo mesmo motivo.
- Fica um padrão único de comparação para esses identificadores, reduzindo a chance de o erro reaparecer.

## Detalhes técnicos
- A evidência atual mostra que o 500 vem desta query:
  - `FROM vw_painelv2_desempenho_julia_contratos`
  - `WHERE whatsapp = ANY($1::varchar[]) AND cod_agent::text = $2::text`
- Isso indica que o problema não está mais na consulta do card nem na sessão, mas na própria consulta de contratos/view.
- Vou trocar os filtros para uma forma compatível com os tipos reais retornados pela view e replicar o mesmo padrão em todos os consumidores dessa view.
- Também vou revisar usos relacionados já mapeados em:
  - `src/pages/crm-builder/hooks/useDealJuliaContext.ts`
  - `src/pages/crm/hooks/useContractInfo.ts`
  - `src/pages/dashboard/hooks/useDashboardFunnels.ts`
  - `src/pages/dashboard/hooks/useDashboardData.ts`
  - pontos equivalentes em páginas estratégicas que usam a mesma view.