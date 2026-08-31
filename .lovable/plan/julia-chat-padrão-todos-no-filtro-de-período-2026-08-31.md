# JulIA Chat: padrão "Todos" no filtro de período

## Objetivo
Deixar o chip "Todos" selecionado por padrão no painel de filtros do JulIA Chat (`/chat`).

## Situação atual
- `DEFAULT_JULIA_FILTERS.period` está definido como `'7d'`.
- Por isso, ao abrir o painel de filtros, o chip ativo é "7 dias", não "Todos".
- O chip "Todos" corresponde ao valor `'all'`.

## Mudança
1. Em `src/modules/julia-chat/api/types.ts`, alterar `DEFAULT_JULIA_FILTERS.period` de `'7d'` para `'all'`.
2. Verificar se há alguma outra inicialização de filtros que sobrescreva esse padrão (ex.: localStorage, URL query) — se houver, ajustar para respeitar o novo default.
3. Rodar build/typecheck para garantir que não há regressão.

## Critérios de aceitação
- Ao abrir `/chat` e expandir "Mais filtros", o chip "Todos" do período deve aparecer selecionado.
- O botão "Limpar filtros" deve continuar resetando para o novo padrão (`'all'`).
- Build sem erros.
