

# Dashboard Exclusivo do Advogado — Contratos

## Resumo

Transformar a página `AdvDashboardPage` em um dashboard completo de contratos, mobile-first, reutilizando os hooks de dados de contratos (`useJuliaContratos`, `useJuliaContratosPrevious`) e o componente `UnifiedFilters`. O advogado verá apenas os contratos do seu `cod_agent`.

## Alterações

### 1. Página `src/pages/adv/AdvDashboardPage.tsx` — Reescrever

Substituir o conteúdo placeholder por um dashboard funcional:

- **Header**: Saudação com nome do usuário + botão Atualizar
- **Filtros**: `UnifiedFilters` com `showAgentSelector={false}` (advogado só vê seu agente), `showStatusFilter`, período
- **Agent code**: Pegar `user.cod_agent` do `useAuth()` e converter para string para usar como `agentCodes` fixo no filtro
- **Summary Cards**: Reutilizar `ContratosSummary` (total, assinados, em curso, taxa)
- **Gráfico de Evolução**: Reutilizar `ContratosEvolutionChart` (diário/semanal/por hora)
- **Tabela de Contratos**: Reutilizar `ContratosTable` com busca
- **Dialog de Detalhes**: Reutilizar `ContratoDetailsDialog`

Layout mobile-first: `max-w-lg mx-auto` para mobile, cards em grid 2 colunas, gráfico responsivo.

### 2. Dados

Reutilizar diretamente os hooks existentes:
- `useJuliaContratos(filters)` — dados de contratos filtrados
- `useJuliaContratosPrevious(filters)` — período anterior para comparação

O `agentCodes` do filtro será fixo com `[String(user.cod_agent)]`, sem seletor de agente.

### 3. Sem alteração em outros arquivos

Todos os componentes já existem e são importáveis diretamente:
- `ContratosSummary`, `ContratosTable`, `ContratosEvolutionChart`, `ContratoDetailsDialog` de `src/pages/estrategico/contratos/components/`
- `UnifiedFilters` de `src/components/filters/`

## Arquivo alterado

| Arquivo | Mudança |
|---|---|
| `src/pages/adv/AdvDashboardPage.tsx` | Reescrever com dashboard de contratos completo |

