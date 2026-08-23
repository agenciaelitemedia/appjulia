# MVP Chat: abrir a conversa real (header, mensagens, envio e barra lateral direita)

Hoje, ao clicar em uma conversa na lista do `/mvp-chat`, a coluna do meio mostra o JSON do feed e a coluna da direita mostra um resumo próprio (`MvpChatDetailsPanel`). A proposta é passar a carregar a **conversa de verdade**, com exatamente os mesmos componentes, regras e formatações do chat principal.

## Como vai funcionar

- Clicar em uma conversa na lista abre, na coluna do meio:
  - o **cabeçalho da conversa** do chat principal (assumir, transferir, resolver, adiar, gerar resumo, ticket, ligar, status da Júlia — tudo conforme permissão do perfil);
  - a **timeline de mensagens** completa (mídia, áudio com transcrição, citações, reações, resumos no fluxo, paginação por scroll, formatação WhatsApp);
  - o **campo de envio** completo (texto formatado, anexos, áudio, mensagens rápidas com `/`, agendamento, resposta/edição).
- A coluna da direita passa a ser a **right-bar do chat principal**, com as abas **Contato**, **CRM** e **Lead**, no mesmo comportamento do `/chat` (abre/fecha pelos botões do cabeçalho).
- Perfil/permissões, filas acessíveis e bloqueio de fila desconectada continuam valendo igual ao `/chat`.
- Nada muda na lista, nos badges, nos filtros nem na consulta única do feed — a lista continua sendo a do MVP.
- O painel de performance (tempo total, SQL, cache) sai da área da conversa e passa a ficar recolhido atrás de um botão "Diagnóstico" no topo da coluna do meio, para não competir com a conversa.
- Em telas menores (< lg), selecionar a conversa mostra a conversa em tela cheia com botão de voltar; a right-bar vira overlay, como no `/chat`.

## Detalhes técnicos

Todos os arquivos novos ficam em `src/modules/mvp-chat/` (nenhum arquivo do chat principal é alterado).

1. `extend/chat.ts` (novo, no padrão dos outros `extend/`): reexporta sem editar `WhatsAppDataProvider`/`useWhatsAppData`, `ChatHeader`, `ChatMessages`, `ChatInput`, `ChatRightBar` e os tipos `ChatMessage`/`ChatContact`/`ChatConversation`/`SelectedQueue`.
2. `components/MvpChatConversation.tsx` (novo): réplica do padrão já validado em `ChatSidePanel.tsx` → `ScopedChat`:
   - hidrata a fila (`queues` por `queue_id`), o contato (`chat_contacts` por `contact_id`) e a conversa (`chat_conversations` por `conversation_id`) com React Query;
   - aplica `setSelectedQueue`, `upsertConversation` e `selectContact` no provider;
   - renderiza `ChatHeader` + `ChatMessages` + `ChatInput`, com estados de carregando/erro/timeout e "Tentar novamente";
   - controla `replyToMessage` / `editingMessage` como o `ChatContainer`;
   - `onShowDetails`/`onShowCrm` alternam a right-bar via `showDetailPanel` + `rightBarTab` do provider.
3. `components/MvpChatRightBar.tsx` (novo, fino): monta `ChatRightBar` na coluna 3 no desktop e em `Sheet` abaixo de `lg`, usando o contato hidratado.
4. `pages/MvpChatPage.tsx`: envolve as colunas 2 e 3 em um único `WhatsAppDataProvider` (instância isolada do MVP, igual ao side panel), passando o `selected` (contact_id, queue_id, conversation_id) para `MvpChatConversation`. A coluna 3 usa a right-bar quando há conversa selecionada; sem seleção mantém o estado vazio atual. `MvpChatPerfPanel` migra para um `Collapsible`/`Popover` no topo.
5. Validação de acesso à fila com `useUserQueueAccess` antes de montar a conversa, com a mesma mensagem de "Acesso restrito" do chat principal.
6. `MvpChatDetailsPanel` continua no repo e passa a ser usado apenas quando não há conversa selecionada (ou removido do fluxo principal), sem alterar seu conteúdo.

## Fora de escopo

- Mudanças na lista MVP, nos badges, nos filtros, no feed SQL ou no cache.
- Qualquer alteração dentro dos componentes do chat principal.
