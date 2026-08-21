# Right-bar do chat não aparece — diagnóstico e correção

## O que foi verificado

- `ChatContainer.tsx` já renderiza a coluna fixa (`hidden lg:flex w-[400px]`), mas **somente quando `showDetailPanel === true`**.
- `WhatsAppDataContext.tsx` inicializa `showDetailPanel` com `useState(false)` e `rightBarTab` com `'contact'`.
- Os gatilhos existem e estão ligados (`Info` → aba Contato, botão `CRM` → aba CRM em `ChatHeader.tsx`).
- Último build: OK, sem erros.

Ou seja: a barra existe e funciona, mas nasce **fechada** em toda sessão — por isso a tela do anexo mostra a conversa até a borda direita, sem a coluna. Ela só aparece depois de clicar no ícone de detalhes ou no botão CRM.

## Correção proposta

1. **Abrir por padrão no desktop**: `showDetailPanel` inicia `true` quando a largura é `>= 1024px` (não abre sozinha no mobile, para não cobrir a conversa).
2. **Persistir a preferência**: guardar aberta/fechada e a aba ativa em `localStorage` (`chat_rightbar_open`, `chat_rightbar_tab`), respeitando a última escolha do usuário entre recarregamentos.
3. **Garantir espaço**: manter a área de conversa com `min-w-0` e reduzir a coluna para `w-[360px] xl:w-[400px]`, evitando aperto em telas de ~1280px como a do anexo.
4. Nenhuma mudança em dados, permissões ou regras — só estado de UI e layout.

## Detalhes técnicos

- `src/contexts/WhatsAppDataContext.tsx`: inicializadores lazy dos dois estados lendo `localStorage` com fallback `window.innerWidth >= 1024`; wrappers dos setters que gravam a preferência.
- `src/components/chat/ChatContainer.tsx`: ajuste das larguras da coluna direita; restante do fluxo (Sheet no mobile, ErrorBoundary) inalterado.
