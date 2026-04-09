

# Corrigir endpoint de listagem de grupos no Assistente de Suporte

## Problema

A aba Grupos chama `/group/fetchAllGroups` que retorna 404. O endpoint correto na API UaZapi é `/group/list` (conforme definido em `src/lib/uazapi/endpoints/group.ts`).

## Correção

Alterar `SupportGroupsTab.tsx` linha 36: trocar `/group/fetchAllGroups` por `/group/list`.

Também ajustar o parsing da resposta para cobrir possíveis formatos de retorno da API (array direto ou objeto com campo `data`/`groups`).

## Arquivo alterado

| Arquivo | Mudança |
|---|---|
| `src/pages/suporte-assistente/components/SupportGroupsTab.tsx` | Trocar endpoint para `/group/list` |

