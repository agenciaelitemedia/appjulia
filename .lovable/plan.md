## Refatoração de layout — `src/components/chat/ChatTicketDetailSidePanel.tsx`

Reestruturar cada `TabsContent` para o padrão **topo fixo + corpo rolável + rodapé fixo**, usando `flex flex-col min-h-0`.

### 1. Aba "Dados do Ticket" — rodapé sticky
- Corpo `flex-1 overflow-y-auto p-4 space-y-3` com os campos do formulário e a linha do solicitante.
- Rodapé `flex-shrink-0 border-t bg-muted/20 px-4 py-3 flex flex-wrap items-center gap-2`:
  - Excluir à esquerda (`mr-auto`)
  - Resolver / Reabrir / Salvar à direita
  - `flex-wrap` evita estouro em telas estreitas.

### 2. Aba "Conversas" — Sobre + Composer fixos no topo, histórico rola
- Topo `flex-shrink-0 border-b p-4 space-y-3`:
  - Card "Sobre este chamado"
  - Toggle Resposta / Nota interna
  - Textarea
  - Linha "Switch WhatsApp .... Responder"
- Corpo `flex-1 overflow-y-auto p-4 space-y-2` com cabeçalho `sticky top-0 bg-background z-10 -mx-4 px-4 py-2 border-b` "Histórico de Conversa" + `<TicketTimeline messages={interactions} … />`.

### 3. Aba "Histórico" — alinhado ao topo
- Topo `flex-shrink-0 px-4 pt-3 pb-2 border-b` com título "Eventos do chamado".
- Corpo `flex-1 overflow-y-auto p-4` com `<TicketTimeline messages={events} />`.
- Empty state alinhado ao topo (`pt-6`), não centralizado verticalmente.

### Ajustes estruturais
- `Tabs` raiz: `flex-1 flex flex-col min-h-0` (mantém).
- `TabsList`: adicionar `flex-shrink-0`.
- Cada `TabsContent`: `flex-1 flex flex-col min-h-0 overflow-hidden mt-0 data-[state=inactive]:hidden` para garantir altura plena.
- Remover `max-h-` arbitrários — referência de altura passa a ser o portal `h-full`.

### Fora de escopo
- Sem mudanças em lógica de mutations, hooks, permissões, `TicketDetailPage`, `ChatTicketSidePanel` ou banco.
