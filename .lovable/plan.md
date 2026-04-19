
## Mudanças

### 1. Botão "Detalhes" no header (ícone visível)
Em `src/components/chat/ChatHeader.tsx`:
- Adicionar um `Button` ghost com ícone `Info` (`h-8 w-8`) na barra de ações, posicionado **logo após o `AIAssistPanel`** (próximo ao ícone da IA), com tooltip "Ver detalhes".
- `onClick={onShowDetails}`.
- Remover o item "Ver detalhes" do `DropdownMenu` (e o `DropdownMenuSeparator` que ficou órfão), mantendo "Criar lead no CRM" no menu.

### 2. Painel de detalhes como overlay (Sheet)
Em `src/components/chat/ChatContainer.tsx`:
- Remover a coluna lateral fixa que renderiza `ContactDetailPanel` (`<div className="hidden lg:flex w-80 ...">`).
- Substituir por um `Sheet` (shadcn) controlado por `showDetailPanel` / `setShowDetailPanel`:
  - `<Sheet open={showDetailPanel} onOpenChange={setShowDetailPanel}>`
  - `<SheetContent side="right" className="w-[380px] sm:w-[420px] p-0">` contendo `<ContactDetailPanel contact={selectedContact} onClose={() => setShowDetailPanel(false)} />`.
- O `Sheet` do shadcn já fecha automaticamente ao clicar fora (overlay) e com Esc — atende o requisito.
- Funciona igual em desktop e mobile (passa a abrir por cima do chat em vez de empurrar).

### 3. Ajuste cosmético
- `ContactDetailPanel` já tem header próprio com botão X — manter; ele continuará funcionando dentro do Sheet.
- Não alterar comportamento do `selectedConversation` nem demais ações do header.

## Arquivos a editar
- `src/components/chat/ChatHeader.tsx` — adicionar ícone Detalhes, remover item do dropdown.
- `src/components/chat/ChatContainer.tsx` — trocar coluna lateral por `Sheet` overlay.

## Resultado esperado
- Ícone `Info` visível no header da conversa, ao lado do ícone da IA.
- Clicar abre painel de detalhes **sobreposto** ao chat (não empurra a área de mensagens).
- Clicar fora do painel ou pressionar Esc fecha automaticamente.
- Mesmo comportamento em telas grandes e pequenas.
