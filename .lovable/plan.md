## Objetivo

Mostrar, em cada item da lista de conversas do `/chat`, um badge "TICKET #N · status" quando a conversa tiver um ticket de suporte **aberto** vinculado — no mesmo estilo dos badges Painel CRM e CRM Julia já existentes em `ChatContactItem`. Para evitar consulta por conversa, persistir o vínculo direto na tabela `chat_conversations`.

## Mudanças

### 1. Banco — nova coluna em `chat_conversations`

Migration adicionando:

- `active_ticket_id uuid null` → referência ao ticket de suporte aberto no momento.
- `active_ticket_number int8 null` → cache do número (#202604004) para evitar join no listagem.
- Índice parcial `where active_ticket_id is not null` para o lookup do mapa.

Sem foreign key dura (mantém padrão dos outros vínculos do projeto e evita falhas em delete de ticket).

### 2. Banco — preenchimento automático via trigger em `support_tickets`

Trigger `AFTER INSERT/UPDATE/DELETE` que mantém o vínculo coerente:

- Ao **criar** ticket com `conversation_id` não nulo e `status NOT IN ('resolved','closed')` → escreve `active_ticket_id` + `active_ticket_number` na conversa correspondente.
- Ao **mudar status** para `resolved`/`closed` → se a conversa ainda aponta para este ticket, volta `active_ticket_id`/`active_ticket_number` para `null`.
- Ao **reabrir** (`resolved/closed → open/...`) → reescreve o vínculo (apenas se conversa não tiver outro ticket ativo; senão mantém o existente).
- Ao **alterar `conversation_id`** do ticket → limpa o vínculo da conversa antiga e seta na nova.
- Ao **deletar** ticket → limpa o vínculo se for o ativo.

Toda escrita é condicionada (`where active_ticket_id is null` ou `= old.id`) para nunca sobrescrever um vínculo de outro ticket aberto. Trigger usa `security definer` com `search_path = public`.

### 3. Backfill

Em uma única instrução, popular `active_ticket_id`/`active_ticket_number` a partir do ticket **aberto mais recente** por `conversation_id` (`status NOT IN ('resolved','closed')`). Operação idempotente, rodada na própria migration.

### 4. Frontend — novo hook `useTicketLinkedConversations`

Arquivo `src/hooks/useTicketLinkedConversations.ts`, espelhando `useCRMBuilderLinkedConversations`:

- Consulta `chat_conversations` filtrando `client_id` e `active_ticket_id is not null`, selecionando apenas `id, active_ticket_id, active_ticket_number`.
- Faz um segundo `select` em `support_tickets` pelos `active_ticket_id` retornados, pegando `id, number, status, subject, priority`.
- Retorna `Map<conversation_id, { ticketId, number, status, subject, priority }>`.
- `staleTime: 30s`; invalidado por realtime de `support_tickets` (canal já presente em outras telas, criado novo no hook).

Custo: 2 queries leves, sem N+1, só traz tickets de fato abertos.

### 5. Frontend — badge na lista de conversas

- `ChatList.tsx`: chama o novo hook e passa `ticketLink={ticketMap?.get(conv.id)}` para `ChatContactItem`.
- `ChatContactItem.tsx`: nova linha logo abaixo da linha do CRM Builder, no mesmo padrão visual (ícone `Ticket` do lucide, label "TICKET", número `#N`, badge de status colorido reusando `STATUS_BADGE` de `pages/tickets/types`). Tooltip com assunto + prioridade. Clique abre `/tickets/:id` em nova aba (igual ao botão CRM).
- Memo: incluir `ticketLink` na comparação de props.

### 6. Frontend — criação/fechamento de ticket

`useTickets.ts` continua chamando apenas `support_tickets`; o vínculo na conversa é responsabilidade da trigger no banco. Nenhuma alteração de lógica no fluxo de criar/fechar/reabrir ticket é necessária — assim não corremos risco de regressão.

## Segurança / não-regressão

- Coluna nova é nullable, sem default → não impacta nenhum insert existente.
- Trigger só toca `chat_conversations` quando `conversation_id` está setado.
- Updates da trigger são scoped (`where id = ... and (active_ticket_id is null or active_ticket_id = old.id)`), preservando vínculos de outras conversas/tickets.
- Tipos do Supabase regenerados após a migration; o hook só é importado depois.

## Detalhes técnicos

```text
chat_conversations
├── active_ticket_id      uuid  null   (novo)
└── active_ticket_number  int8  null   (novo, cache)

trigger trg_support_tickets_link_conversation
  AFTER INSERT OR UPDATE OF status, conversation_id OR DELETE
  ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.sync_conversation_active_ticket();
```

Status "aberto" = `status NOT IN ('resolved','closed')`.
