# Lista do JulIA Chat: privados por padrão, grupos só por filtro

## Situação atual (verificada)

- `DEFAULT_JULIA_FILTERS.tab` está `null` — ou seja, a lista abre misturando conversas individuais **e** grupos.
- A função do banco `chat_list_feed` já aceita `p_tab`: `'individual'` filtra `NOT is_group` e `'groups'` filtra `is_group`. Os contadores das abas também respeitam esse filtro.
- O ícone de grupos já existe na barra de filtros e só aparece quando o plano libera grupos (`useAgentQueueLimits().allowGroups`). Hoje ele alterna entre `'groups'` e `null` (em vez de voltar para "só individuais").

## O que muda

1. **Padrão = somente conversas privadas**: filtro inicial passa a ser `tab: 'individual'`.
2. **Ícone de grupos** (visível apenas quando o recurso está liberado) alterna entre `individual` e `groups`; nunca deixa o estado misto.
3. **Sem o recurso de grupos**, o filtro é forçado para `individual` (hoje volta para `null`, que trazia grupos junto).
4. **Chip de filtro ativo**: mostra "Grupos" apenas quando os grupos estão selecionados; "Individuais" (padrão) não gera chip, e limpar o chip volta para `individual`.
5. **Limpar filtros / reset** mantém `individual` como padrão.

## Detalhes técnicos

- `src/modules/julia-chat/api/types.ts`: `DEFAULT_JULIA_FILTERS.tab = 'individual'`.
- `src/modules/julia-chat/components/JuliaChatFilters.tsx`:
  - efeito de guarda: `if (!showGroupsTab && filters.tab !== 'individual') onChange({ tab: 'individual' })`;
  - botão de grupos: `onChange({ tab: filters.tab === 'groups' ? 'individual' : 'groups' })`;
  - `activeChips`: só empilha o chip quando `filters.tab === 'groups'`, com `clear` voltando para `individual`.
- Nenhuma alteração no banco nem na edge function — o parâmetro `tab` já é enviado por `fetchJuliaChatFeed` e tratado no servidor.
- Contadores das abas (Aguardando / Em atendimento / Resolvidos) passam a refletir apenas o escopo selecionado (privados ou grupos), o que é o comportamento esperado.
