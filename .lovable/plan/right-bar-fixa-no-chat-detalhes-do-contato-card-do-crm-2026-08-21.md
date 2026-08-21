# Right-bar fixa no Chat (Detalhes do contato + Card do CRM)

Hoje o Chat tem duas superfícies que cobrem a conversa:
- **Detalhes do contato**: `Sheet` que desliza sobre o chat (`ContactDetailPanel`).
- **Card do CRM**: pop-up/sheet (`ChatLinkedDealSheet` → `DealDetailsSheet`).

A proposta é substituir essas sobreposições por uma **coluna lateral direita fixa (right-bar)**, com o mesmo tema/vidro/gradiente do painel atual, dividida em abas.

## Como vai funcionar

- Nova coluna à direita do chat, largura ~400px (desktop), com borda e superfície de vidro no padrão do projeto (`aj-content-glass` / tokens semânticos existentes).
- Duas abas no topo: **Contato** e **CRM**.
  - **Contato**: todo o conteúdo atual de detalhes do contato, sem mudança de campos ou ações.
  - **CRM**: se a conversa já tem card vinculado, mostra os detalhes do card inline; se não tem, mostra o estado "criar card no CRM" (fluxo atual) dentro da própria aba.
- Botões existentes passam a alternar/abrir a right-bar na aba certa em vez de abrir sobreposição:
  - ícone de detalhes no header → abre aba **Contato**;
  - botão **CRM** no header → abre aba **CRM**.
- A right-bar pode ser fechada (X) e o estado (aberta/fechada + aba ativa) é mantido enquanto o usuário navega entre conversas.
- Em telas menores (< lg) a right-bar continua se comportando como overlay/sheet, para não comprimir a conversa no mobile.
- Nenhuma regra de negócio, permissão ou persistência muda — só a apresentação.

## Detalhes técnicos

1. **Estado**: reaproveitar `showDetailPanel` do `WhatsAppDataContext` e adicionar `rightBarTab: 'contact' | 'crm'` (com setter). Sem novas queries.
2. **Novo componente** `src/components/chat/ChatRightBar.tsx`:
   - header com título + `Tabs` (Contato/CRM) + botão fechar;
   - aba Contato renderiza `ContactDetailPanel` (com `onClose` ligado ao fechar da barra);
   - aba CRM usa `useChatDealLink` (já existente) e renderiza os detalhes do deal ou o formulário de criação.
3. **`ChatContainer.tsx`**: adiciona a coluna como irmã da área de chat em `lg+` (`hidden lg:flex w-[400px] border-l`), mantendo o `Sheet` atual apenas para telas menores. A área de chat segue `flex-1 min-w-0`.
4. **Reuso do CRM sem duplicar código**: adicionar prop opcional `variant="inline"` (default `sheet`) em `DealDetailsSheet` — o corpo atual é extraído para uma variável e o wrapper `Sheet`/`SheetContent` só é aplicado no modo `sheet`. Mesmo tratamento para `CreateCrmCardSheet` (modo inline sem `Sheet`).
   - `ChatLinkedDealSheet` ganha o mesmo repasse de `variant`, mantendo o uso atual (pop-up) intacto no CRM Builder e no `BoardChatSidePanel`.
5. **Estilo**: usar apenas tokens/classes já existentes (`border-border`, `bg-card/…`, `aj-*`), sem cores hardcoded.

## Fora de escopo

- Mudanças nos campos, ações, permissões ou dados dos painéis.
- Redesenho da lista de conversas ou da timeline de mensagens.
