## Objetivo

No CRM Builder, ao clicar no ícone do WhatsApp em um card, em vez de abrir um painel **inline** que empurra o board para a esquerda, abrir um **Sheet lateral overlay** (igual ao "Detalhes do contato" do módulo `/chat`) que sobrepõe a tela inteira a partir da direita, sem alterar o layout do Kanban.

## Padrão a replicar

O `ChatContainer.tsx` usa este padrão para detalhes do contato:

```tsx
<Sheet open={showDetailPanel} onOpenChange={setShowDetailPanel}>
  <SheetContent side="right" className="w-[456px] sm:w-[504px] sm:max-w-[504px] p-0 overflow-y-auto">
    <ContactDetailPanel ... />
  </SheetContent>
</Sheet>
```

## Mudanças

### 1. `src/pages/crm-builder/components/deals/BoardChatSidePanel.tsx`
- Envolver o conteúdo atual em `<Sheet>` + `<SheetContent side="right">`.
- Largura responsiva maior (chat tem header + mensagens + input): `w-[480px] sm:w-[560px] md:w-[640px] lg:w-[720px] sm:max-w-[720px]`.
- `p-0` no `SheetContent`, `overflow-hidden` para o chat gerenciar seu próprio scroll.
- Manter o `WhatsAppDataProvider` isolado e o `ScopedChat` exatamente como estão.
- Substituir prop `deal: CRMDeal | null` + `onClose` por padrão controlado: `open: boolean`, `onOpenChange: (v: boolean) => void`, `deal: CRMDeal | null`.
- Remover o `<aside>` inline e o handler manual de `Esc` (o `Sheet` do shadcn já cuida disso, e do overlay/click-outside).
- Manter o header interno mini (botão "Abrir no Chat" + fechar) acima do `ChatHeader`, já que o `Sheet` não tem header próprio aqui.

### 2. `src/pages/crm-builder/BoardPage.tsx`
- Remover do layout o slot inline que reservava espaço de 420–480px à direita do board.
- Voltar o container do board para o layout original (ocupando 100% da largura disponível).
- Continuar mantendo o estado `chatPanelDeal` (ou renomear para `chatPanelOpen` + `chatPanelDeal`) e passar para o `BoardChatSidePanel` como `open` / `onOpenChange` / `deal`.
- O `Sheet` é renderizado fora do fluxo (portal), então pode ficar no nível raiz do `BoardPage` sem afetar o grid.

## Resultado de UX

- Clique no ícone WhatsApp do card → Sheet desliza da direita sobre o board (overlay escurecido).
- Board permanece visível atrás (parcialmente), sem reflow das colunas.
- Fechar: botão X, tecla Esc, ou clique fora — todos nativos do `Sheet`.
- Botão "Abrir no Chat" continua disponível para ir ao módulo `/chat` completo.
- Comportamento idêntico ao painel de "Detalhes do contato" do `/chat`, mantendo consistência visual em todo o produto.

## Arquivos

- ✏️ `src/pages/crm-builder/components/deals/BoardChatSidePanel.tsx` — converter para `Sheet`
- ✏️ `src/pages/crm-builder/BoardPage.tsx` — remover slot inline, renderizar Sheet no nível raiz
