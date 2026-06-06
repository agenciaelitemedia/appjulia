# Menu de ações rápidas na lista de conversas

Replicar o comportamento do WhatsApp Web: ao passar o mouse sobre um item da lista de conversas, exibir uma seta para baixo (à direita, logo após o ícone de prioridade) que abre um dropdown com três ações.

## Ações do menu (com ícones Lucide)

1. **Assumir conversa** — `UserPlus` — atribui a conversa ao usuário logado (`assigned_to = currentUserName`, `status = 'open'`).
2. **Transferir conversa** — `ArrowRightLeft` — abre o `TransferDialog` já existente.
3. **Encerrar conversa** — `CheckCircle2` — marca `status = 'closed'`, `closed_at = now()` e desatribui. use o componente de encerrar conversa ja existente, deve ter a mesma açao do botao encerrar conversa do chat de mensagens

Texto em PT-BR simples, toasts de sucesso/erro padronizados (`sonner`).

## Arquivos afetados

- `**src/components/chat/ChatContactItem.tsx**` (edição)
  - Adicionar estado de hover (via classes Tailwind `group` / `group-hover`) — o container raiz já tem hover; basta marcar como `group`.
  - Após o `<PriorityBadge>`, renderizar um novo componente `<ConversationQuickActions conversation={conversation} />`.
  - O botão trigger (chevron `ChevronDown`) usa `opacity-0 group-hover:opacity-100 focus-visible:opacity-100` + `data-[state=open]:opacity-100` para só aparecer no hover ou quando o menu está aberto.
  - `stopPropagation` no clique do trigger e nos itens, para não disparar a seleção da conversa.
- `**src/components/chat/ConversationQuickActions.tsx**` (novo)
  - Recebe `conversation: ChatConversation`.
  - Usa `DropdownMenu` (shadcn) com `DropdownMenuTrigger asChild` num `Button` ghost pequeno.
  - Itens:
    - Assumir: `supabase.from('chat_conversations').update({ assigned_to: currentUserName, status: 'open' }).eq('id', conversation.id)`.
    - Transferir: abre `TransferDialog` local (estado interno) reutilizando o componente existente; ao confirmar faz o mesmo update + registra histórico (`chat_conversation_history`) como já é feito no `ChatHeader` — extrair a lógica mínima necessária ou duplicar de forma enxuta.
    - Encerrar: update `status='closed', closed_at: new Date().toISOString(), assigned_to: null` + entrada de histórico `action: 'status_changed'` para `closed`.
  - Invalida `queryClient` nas chaves de conversas (`['chat-conversations']`, `['chat-contacts']`) após cada ação.
  - Usuário atual via `useAuth()`.

## Detalhes técnicos

- O menu aparece somente no hover do item; visível também enquanto aberto (para não fechar ao perder o hover).
- Não alterar tokens de cor: usar `text-muted-foreground hover:text-foreground` no chevron.
- Sem mudanças de schema, hooks de dados ou backend — reutiliza tabelas e padrões já existentes (`chat_conversations` + `chat_conversation_history`).
- Manter o `React.memo` do `ChatContactItem` funcionando: o subcomponente é estático em props (recebe só `conversation`), então não afeta a comparação.

## Fora de escopo

- Configurar visibilidade do menu em `chat_client_settings` (pode ser adicionado depois se desejar).
- Confirmações modais para encerrar (mantém ação direta com toast; podemos adicionar confirmação se preferir — me avise).