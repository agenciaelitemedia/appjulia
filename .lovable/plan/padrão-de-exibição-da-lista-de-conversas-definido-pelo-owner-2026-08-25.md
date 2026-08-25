# Padrão de exibição da lista de conversas (definido pelo owner)

## Objetivo

O owner do escritório (client_id) escolhe, no menu de ações da lista do /chat, se a
visão dos cards de conversa começa **Reduzida** (só o badge de fila) ou **Expandida**
(todos os badges visíveis). A escolha é salva no banco e vale para toda a equipe
daquele client_id.

## Como fica na interface

- No menu "⋮" (ações) da barra de filtros do chat, um novo submenu **Exibição da lista**
  com duas opções em rádio:
  - Reduzida (padrão) — apenas o badge da fila, com a setinha para expandir.
  - Expandida — todos os badges (responsável, IA, SLA, CRM, campanha) já abertos.
- O submenu aparece **somente para o owner** do client_id. Os demais usuários da equipe
  não veem a opção, apenas herdam o padrão definido.
- Ao salvar, toast de confirmação e a lista já reflete o novo padrão.
- Cada usuário continua podendo abrir/recolher um card individualmente durante o uso —
  a configuração só define como os cards **iniciam**.

## Persistência

Reuso da tabela existente `chat_client_settings` (uma linha por client_id, campo JSON
`settings`). Nova chave: `julia_chat_row_default_expanded: boolean` (default `false`).
Não é necessária migração de banco — o campo é JSON.

## Detalhes técnicos

- `src/hooks/useChatClientSettings.ts`: adicionar `julia_chat_row_default_expanded`
  à interface, aos `DEFAULTS` e ao parse do JSON (o `update` já faz merge preservando
  as outras chaves).
- `src/modules/julia-chat/components/JuliaChatFilters.tsx`: dentro do
  `DropdownMenuContent` do "⋮", adicionar um `DropdownMenuSub` "Exibição da lista" com
  `DropdownMenuRadioGroup` (`reduzida` | `expandida`), renderizado apenas quando
  `useIsOwner()` for verdadeiro; `onValueChange` chama
  `update.mutate({ julia_chat_row_default_expanded: v === 'expandida' })`.
- `src/modules/julia-chat/components/JuliaChatRow.tsx`: trocar
  `useState(false)` de `badgesExpanded` por inicialização com o valor vindo de
  `useChatClientSettings()`, com `useEffect` para re-sincronizar quando o padrão do
  client mudar (mantendo o toggle manual do usuário até a próxima mudança de padrão).
- Nenhuma alteração em queries de feed, RLS ou lógica de negócio.
