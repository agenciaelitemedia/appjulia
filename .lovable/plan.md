# Separar Interações de Histórico no detalhe do ticket

Hoje a coluna direita ("Interações") mistura respostas, notas internas e eventos (criação, mudança de status, atribuição). O usuário quer separar:

- **Interações** (coluna direita): apenas respostas públicas e notas internas, com um cabeçalho acima descrevendo do que se trata o chamado.
- **Histórico** (coluna esquerda, aba ao lado de "Detalhes" — como antes): timeline com todos os eventos do chamado (criação, mudança de status, atribuição, CSAT, etc.).

## Mudanças em `src/pages/tickets/TicketDetailPage.tsx`

### 1. Coluna esquerda volta a ter abas Detalhes / Histórico
- Reintroduzir `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` e o ícone `Activity` nos imports.
- Envolver o conteúdo atual da coluna esquerda em `<Tabs defaultValue="detalhes">` com duas abas: "Detalhes" (conteúdo atual) e "Histórico".
- A aba **Histórico** renderiza `<TicketTimeline messages={eventsOnly} />`, onde `eventsOnly = messages.filter((m) => m.kind === 'event')`. Reaproveita o componente `TicketTimeline` já criado para manter o visual de linha do tempo vertical com bullets.

### 2. Coluna direita: cabeçalho do chamado + somente interações
- Renomear título para "Interações" (já está) e, **acima da lista**, adicionar um bloco "Sobre este chamado" com:
  - Assunto (`ticket.subject`) em destaque.
  - Descrição original (`ticket.description`) com `whitespace-pre-wrap`, se existir.
  - Mantém o estilo de card sutil (`bg-muted/30 border rounded-md p-3`).
- Filtrar a lista para `interactionsOnly = visibleMessages.filter((m) => m.kind !== 'event')` antes de passar para `<TicketTimeline />`.
- Mantém o composer (Resposta / Nota interna) no rodapé sem mudanças.

### 3. Empty states
- Se não houver interações, mostrar "Sem respostas ou notas ainda." no lugar da lista.
- Se não houver eventos no histórico, manter "Sem interações ainda." (texto do `TicketTimeline` já cobre — apenas trocar para "Sem eventos registrados.").

## Fora do escopo
- Sem mudanças em hooks, tipos, banco, edge functions ou em qualquer outra tela.
- Componente `TicketTimeline` permanece (apenas passa a receber subconjuntos diferentes de mensagens em cada local).

## Validação
- `/tickets/:id`: coluna esquerda tem abas "Detalhes" e "Histórico"; a aba Histórico mostra apenas eventos (criação, status, atribuição, CSAT) em timeline.
- Coluna direita mostra "Sobre este chamado" (assunto + descrição) acima da lista de Interações, que contém apenas respostas e notas internas.
- Composer continua funcionando igual.
