## Objetivo

Transformar o painel lateral `ChatTicketDetailSidePanel` (aberto pelo menu "Ver ticket de suporte #N" na lista de conversas / header do chat) em uma visão completa com 3 abas, espelhando a experiência da página `/tickets/:id`, sem trocar de tela.

## Estrutura das abas

```text
┌─ Ticket #1234 · [Status]                              [↗] [X] ┐
│ [ Dados do Ticket ] [ Conversas ] [ Histórico ]               │
├───────────────────────────────────────────────────────────────┤
│                       (conteúdo da aba)                       │
└───────────────────────────────────────────────────────────────┘
```

### Aba 1 — Dados do Ticket (imagem 1)
Mantém o formulário atual já existente no painel, exatamente como na referência:
- Assunto, Descrição
- Responsável pelo atendimento (TeamMemberSelect)
- Departamento / Categoria (lado a lado)
- Prioridade / Status atual (lado a lado)
- Rodapé fixo: linha "Solicitante: NOME [PROTOCOLO] · telefone"
- Botões Salvar / Resolver / Reabrir / Excluir (rodapé existente)

### Aba 2 — Conversas (imagem 2)
Nova aba, replicando o bloco da coluna direita de `TicketDetailPage`:
- Card "SOBRE ESTE CHAMADO" no topo (assunto + descrição em destaque)
- Toggle Resposta / Nota interna (somente agentes)
- Textarea "Escreva uma resposta…"
- Switch "Enviar para WhatsApp" + botão "Responder" (mesma lógica de `chatTarget`/`reply.mutateAsync` já usada em `TicketDetailPage`)
- Lista "Histórico de Conversa" abaixo, usando o componente `TicketTimeline` filtrando `messages` para `kind !== 'event'` (respostas públicas + notas internas), com edição/exclusão pela janela de 15min já existente

### Aba 3 — Histórico (imagem 3)
Timeline cronológica de eventos:
- Reusa `TicketTimeline` com `messages.filter(m => m.kind === 'event')`
- Mostra eventos do tipo: Chamado aberto, Status alterado, Resposta enviada, Resposta excluída, Nota interna excluída, Mensagem editada, Atribuição, etc.

## Detalhes técnicos

**Arquivo único alterado:** `src/components/chat/ChatTicketDetailSidePanel.tsx`

1. Trocar o body atual por um layout com `<Tabs defaultValue="dados">` (shadcn), com `TabsList` logo abaixo do header e três `TabsContent` roláveis.
2. Extrair o formulário atual (linhas ~194–289) para uma sub-aba `dados` mantendo `useTicket`, `useTicketMutations`, `useSupportConfig`, `useTeamByClient`, e os estados `subject/description/priority/...` já existentes.
3. Para as abas `conversas` e `historico`:
   - Estender a desestruturação de `useTicketMutations()` para incluir `reply`, `editMessage`, `deleteMessage`.
   - Ler `messages` de `useTicket(ticketId)` (já retornado pelo hook).
   - Importar `TicketTimeline` e o tipo `TicketMessage` exportando-os do módulo de tickets. Como `TicketTimeline` hoje é função local em `TicketDetailPage.tsx`, mover para um arquivo compartilhado novo `src/pages/tickets/components/TicketTimeline.tsx` e re-importar tanto em `TicketDetailPage` quanto no painel.
   - Replicar o `chatTarget` (mesma `useQuery` com `queryKey: ['ticket-chat-target', ...]`) para habilitar o switch "Enviar para WhatsApp"; pode-se extrair para hook `useTicketChatTarget(ticket)` em `src/pages/tickets/hooks/useTicketChatTarget.ts` e reutilizar nos dois locais (refator opcional, mas recomendado para evitar duplicação).
4. Permissões: respeitar `hasPermission('support_tickets', 'edit'/'delete')` igual ao painel atual; respostas/notas seguem o gate de `isAgent` (via `useTicketRole`).
5. Rodapé com botões Salvar / Resolver / Reabrir / Excluir continua visível apenas na aba "Dados do Ticket" (move o `<div>` do rodapé para dentro do `TabsContent value="dados"`); nas demais abas o rodapé não é necessário pois respostas têm seu próprio botão.

## Fora de escopo
- Página `/tickets/:id` mantém seu layout atual (apenas extrai `TicketTimeline` para arquivo compartilhado).
- `ChatTicketSidePanel` (criação de novo ticket) permanece inalterado.
- Nenhuma mudança de banco, RLS ou edge function.
