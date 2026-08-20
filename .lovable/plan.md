# Remover resumo do dashboard do CRM de leads

## Objetivo
Remover a faixa de cards de resumo estatístico do topo da página `/crm/leads` (componente `CRMDashboardSummary`), mantendo o restante da página intacto.

## Alterações
1. **Remover `CRMDashboardSummary`** do JSX de `src/pages/crm/CRMPage.tsx`.
2. **Limpar import e hooks** que alimentavam apenas o resumo removido:
   - Remover import de `CRMDashboardSummary`.
   - Remover `useCRMJuliaSessions`, `useCRMJuliaConversations` e `useFollowupReturnRate` do import de hooks.
   - Remover as chamadas a `useCRMJuliaSessions`, `useCRMJuliaConversations` e `useFollowupReturnRate`.
   - Manter `useFollowupActiveLeads` e `followupMap`, pois são usados por `CRMPipeline`.
3. **Manter comportamentos existentes**: filtros, totalizadores, pipeline, diálogo de detalhes e atualização continuam iguais.
4. **Validar**: rodar build e verificar visualmente que a faixa de 7 cards sumiu e a página ainda carrega normalmente.
