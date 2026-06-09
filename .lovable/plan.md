# Redesenho da tela de detalhes do ticket

A tela atual (`/tickets/:id`) trata as interações como um chat (bolhas alinhadas à esquerda/direita, aba "Histórico" separada). Ticket de suporte não é conversa de WhatsApp — o esperado é uma **timeline unificada** com todos os eventos do chamado em ordem cronológica.

## Mudanças em `src/pages/tickets/TicketDetailPage.tsx`

### 1. Remover o layout estilo chat
- Remover o card "Conversa" com bolhas (`bg-primary/10` / `bg-muted` alinhadas por `justify-end` / `justify-start`) — linhas 334–366.
- Remover a aba duplicada **Histórico** da coluna esquerda (linhas 213–332 viram apenas "Detalhes", sem `Tabs`). O histórico passa a viver como timeline única na coluna direita.
- Remover o componente local `TicketHistory` (linhas 61–93) — substituído pelo novo `TicketTimeline`.

### 2. Novo componente `TicketTimeline` (mesmo arquivo)
Renderiza **todas** as `messages` (eventos, respostas públicas e notas internas) como uma única linha do tempo vertical em ordem cronológica **decrescente** (mais recente no topo):

```text
│ ● [ícone]  Resposta de João Silva                 09/06 14:32
│            "Olá, segue o procedimento..."
│
│ ◌ [ícone]  Nota interna · Maria                   09/06 14:10
│            "Cliente já havia pedido reembolso..."
│
│ ◇ [ícone]  Status alterado: Aberto → Em andamento 09/06 13:55
│            por Maria
│
│ ◇ [ícone]  Responsável atribuído: Maria           09/06 13:50
│
│ ● [ícone]  Chamado criado por Cliente Foo         09/06 13:45
```

Tratamento por tipo:
- `kind === 'public'`: card com borda neutra, cabeçalho "Resposta de {autor}", corpo `whitespace-pre-wrap`. Sem distinção visual "esquerda/direita".
- `kind === 'internal'`: card com fundo âmbar suave (`bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/60`), cabeçalho "Nota interna · {autor}". Só visível para `isAgent`.
- `kind === 'event'`: linha compacta de uma linha (sem card), texto `text-muted-foreground`, ícone conforme `event_type` (`CircleDot` criado, `ArrowRightLeft` status, `UserCheck` atribuído, `Flag` outros, `StarIcon` csat).

Estrutura visual: rail vertical (`border-l ml-3`) com pontos/ícones encostados, conteúdo à direita. Densidade compacta (`text-sm`, `gap-3`).

### 3. Coluna direita: Descrição + Timeline + Composer
- Card único com:
  - **Descrição original** (mantém o bloco atual `bg-muted/30` se houver `ticket.description`).
  - **Timeline** (`<TicketTimeline messages={visibleMessages} />`) com `max-h-[60vh] overflow-y-auto`.
  - **Composer** (mantém Textarea + toggle Resposta/Nota interna + botão Enviar — sem mudanças funcionais).

### 4. Coluna esquerda: só "Detalhes"
Remover `Tabs` e manter o conteúdo de "Detalhes" direto no `CardContent`. Permanece: badges (status/prioridade/SLA), selects de status/prioridade/depto/categoria/responsável (para agente), bloco solicitante, botão "Abrir conversa" (quando há `contact_id`), bloco CSAT.

## Fora do escopo
- Sem mudanças no banco, hooks (`useTickets`), tipos ou edge functions.
- Sem mudanças no `ChatSidePanel`, `ChatTicketDetailSidePanel` ou na lista de conversas (`ChatContactItem`/`ChatHeader`).
- Sem alterações no comportamento do composer (envio de resposta/nota continua igual).

## Validação
- Abrir `/tickets/:id`: a coluna direita exibe descrição, timeline única em ordem decrescente, composer no rodapé. Sem bolhas estilo chat.
- Agente vê notas internas em âmbar; solicitante não as vê.
- Eventos (criação, mudança de status, atribuição, CSAT) aparecem como linhas compactas intercaladas na timeline.
- Coluna esquerda mostra apenas "Detalhes" (sem aba "Histórico").
