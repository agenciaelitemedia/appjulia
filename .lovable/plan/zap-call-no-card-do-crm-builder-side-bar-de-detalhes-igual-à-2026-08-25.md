# ZAP Call no card do CRM Builder + side bar de detalhes igual à do chat

## 1. Botão ZAP Call no card do CRM Builder

- No card (`DealCard`), ao lado direito do ícone laranja de ligação VoIP, entra o ícone de **ZAP Call**.
- Reutiliza o mesmo componente já usado no chat (`WavoipCallButton`, modo `iconOnly`), que abre o mesmo diálogo de chamada por WhatsApp (e o upsell quando o plano não está ativo).
- Tooltip explicativo: "Iniciar ZAP Call (WhatsApp)" quando disponível e "ZAP Call indisponível" quando o usuário não tem plano/dispositivo pronto.
- Só aparece quando o card tem telefone. O clique não abre o card nem inicia arraste (stopPropagation no click e no pointerDown).

## 2. Detalhes do card com a mesma side bar do chat

Hoje "Detalhes" abre o `DealDetailsSheet`. Passa a abrir a **mesma right-bar do chat**, com as abas **Contato / CRM / Telefonia**:

- Aba ativa ao abrir pelo card do CRM: **CRM** (com o conteúdo atual do card, inline).
- **Contato**: mesmo painel de detalhes do contato usado no `/chat` (identidade, tags, observadores, informações da conversa, campanhas, resumos, histórico).
- **Telefonia**: o painel de histórico de ligações (Voip Call / ZAP Call) já criado para o chat.
- Quando o card não tem vínculo com contato/conversa do chat, as abas Contato e Telefonia não aparecem e o comportamento fica igual ao de hoje (somente os detalhes do card).
- A aba **Lead** (CRM da Jul.IA) continua exclusiva do chat.

## 3. Reordenação da aba Contato (chat e CRM)

Nova ordem na aba **Contato**, conforme a referência:

1. **TAGS**
2. **OBSERVADORES**
3. **INFORMAÇÕES DA CONVERSA** (título atual "Conversa Atual" é renomeado)

Os campos e ações do bloco permanecem os mesmos (protocolo, canal, fila, atribuído, SLA, etapa da Julia, prioridade, aberta em, 1ª resposta, ressincronizar). A mudança vale para o `/chat` e para a nova side bar do CRM Builder.

## Detalhes técnicos

- `src/pages/crm-builder/components/deals/DealCard.tsx`: importar `WavoipCallButton` de `@/modules/julia-chat/chat/components` e renderizar após o botão VoIP, envolto em `Tooltip` e num `span` com `onClick`/`onPointerDown` com `stopPropagation`.
- Novo `src/pages/crm-builder/components/deals/DealRightBarSheet.tsx`:
  - resolve a conversa/contato do deal com `useDealConversation` + fetch do `chat_contacts` (mesmo padrão de hidratação usado em `ChatSidePanel`);
  - monta um `WhatsAppDataProvider` isolado com a conversa/fila resolvidas e renderiza `ChatRightBar` dentro de um `Sheet` (largura ~440px), com `rightBarTab` inicial `'crm'`;
  - sem contato resolvido, renderiza o `DealDetailsSheet` atual (fallback).
- `ChatRightBar` (`src/modules/julia-chat/chat/components/ChatRightBar.tsx` e o gêmeo em `src/components/chat/`): aceitar props opcionais `initialTab` e `hiddenTabs`/`dealOverride` para (a) abrir em CRM e (b) usar o deal já conhecido do board em vez de re-resolver o vínculo. Nenhuma mudança no uso atual do chat.
- `WhatsAppDataContext`: `rightBarTab` já suporta `'contact' | 'crm' | 'lead' | 'phone'`; apenas permitir definir o valor inicial na criação do provider.
- `ContactDetailPanel.tsx` (as duas cópias, chat principal e `src/components/chat/`): mover o bloco de Tags + `ConversationParticipants` para antes do bloco da conversa e trocar o rótulo para "Informações da Conversa".
- `src/pages/crm-builder/BoardPage.tsx`: trocar o render do `DealDetailsSheet` pelo novo `DealRightBarSheet`, mantendo as mesmas props e permissões.
- Sem mudanças de banco, permissões ou regras de negócio; apenas apresentação e reuso de componentes.
