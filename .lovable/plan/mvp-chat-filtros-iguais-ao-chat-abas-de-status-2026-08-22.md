# /mvp-chat: filtros iguais ao /chat + abas de status

Objetivo: no protótipo `/mvp-chat`, reaproveitar os mesmos componentes/ícones do `/chat` nas listas de **filas**, **atendimentos (responsável)** e **etapas**, remover o filtro de Status do painel "Mais filtros" e transformá-lo em **abas** como no `/chat`. Padrões de entrada: período **7 dias** e aba **Atendimento**.

Nada no `/chat` é alterado — apenas consumimos os componentes existentes.

## 1. Lista de filas (mesmo componente do /chat)

- Trocar o popover atual (checkbox multi-seleção) pelo padrão do `/chat`: `Popover` + `Command` com `CommandInput` "Buscar fila…", item "Todas as filas" com ícone `Layers` e `Check`, filas ordenadas por nome (pt-BR) e badge de canal por `channel_type` (WhatsApp / WABA / WebChat / Instagram, com as mesmas cores do `/chat`).
- Seleção única (como no `/chat`): selecionar fila → `queue_ids: [id]`; "Todas as filas" → `queue_ids: []`.
- Passar a incluir `channel_type` na lista de filas carregada pelo hook de opções, para renderizar o badge.

## 2. Lista de atendimentos (responsável)

- Substituir o `Select` simples pelo componente compartilhado `TeamMemberSelect` (o mesmo do `/chat`, com Atalhos / Equipe, avatares, badges de papel e status online), com os mesmos atalhos e ícones:
  - `Todos Atendimentos` (`Users`), `Meus atendimentos` (`UserCheck`, badge "EU"), `Aguardando Atendimento` (`UserX`).
- Membros vindos do hook de equipe já existente no projeto, com `valueKey="name"` (o feed filtra responsável por nome) e `allowUnassigned={false}`, `size="sm"`.

## 3. Lista de etapas + modo de atendimento

- Manter a faixa destacada com os 3 ícones de modo (`ListFilter` / `Bot` verde / `User` âmbar) e o popover de etapas, alinhando ao `/chat`: cabeçalho "Selecionar todas / Desmarcar todas" com `Checkbox`, itens com bolinha de cor, tooltip "Filtrar por etapas do CRM da Júlia", rótulo "Todas as etapas" / "N etapas".

## 4. Status → abas (como no /chat)

- Remover o campo Status do painel "Mais filtros" e o chip-resumo de status.
- Adicionar acima da lista uma faixa de abas com as mesmas cores/contadores do `/chat`:
  - `Encerradas` (sem badge), `Aguardando` (âmbar, contador), `Atendimento` (verde, contador).
- Contadores vêm dos counters já retornados pelo feed (`pending`, `open`, `closed`/`resolved`).
- Mesma linha de 2px no topo da lista indicando a aba ativa (âmbar/verde), como no `/chat`.

## 5. Padrões iniciais

- `DEFAULT_MVP_FILTERS`: `period: '7d'` e `status: 'open'` (aba Atendimento ativa ao entrar).
- "Limpar filtros" volta para esses mesmos padrões.

## Detalhes técnicos

- Arquivos alterados:
  - `src/modules/mvp-chat/extend/ui.ts` — exportar `Command*` e `TeamMemberSelect` (reuso, sem cópia).
  - `src/modules/mvp-chat/components/MvpChatFilters.tsx` — filas via Command, responsável via TeamMemberSelect, etapas com "selecionar todas", remoção do Status.
  - `src/modules/mvp-chat/components/MvpChatStatusTabs.tsx` (novo) — abas de status.
  - `src/modules/mvp-chat/pages/MvpChatPage.tsx` — render das abas entre filtros e lista, mantendo a área sem barra de rolagem da página.
  - `src/modules/mvp-chat/hooks/useMvpChatOptions.ts` — incluir `channel_type` nas filas.
  - `src/modules/mvp-chat/api/types.ts` — novos defaults (`7d`, `open`).
- Nenhuma mudança em SQL/edge function: `p_status`, `p_queue_ids` e `p_owners` já são suportados.
