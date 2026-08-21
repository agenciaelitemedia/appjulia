# Corrigir overlay da right-bar e abertura padrão

## O que está acontecendo

No `ChatContainer` existem duas versões da right-bar:

- coluna fixa (desktop, `hidden lg:flex`)
- `Sheet` de overlay (mobile/tablet)

O `Sheet` de overlay é montado em **qualquer** largura de tela. Apenas o `SheetContent` recebe `lg:hidden`; o `SheetOverlay` (a cortina escura renderizada dentro do `SheetContent` no portal) não tem essa classe. Resultado no desktop: a coluna fixa aparece, mas a cortina invisível/escura fica sobre toda a tela e bloqueia cliques na conversa.

Além disso, a barra "só abre ao clicar no ícone" porque a preferência salva em `localStorage` (`chat_rightbar_open`) já foi gravada como `false` numa interação anterior, então o padrão de abrir no desktop não é mais aplicado.

## Correção

1. **Não montar o Sheet no desktop**: usar o hook existente `use-mobile` (ou uma checagem de largura `< 1024px` com listener de resize) no `ChatContainer` e renderizar o `Sheet` da right-bar somente quando a tela não é desktop. Assim nenhum overlay/portal existe no desktop.
2. **Reforço defensivo**: manter `lg:hidden` também no overlay/quando aplicável, para que mesmo em transições de resize a cortina não cubra a tela.
3. **Abertura padrão**: tratar a chave `chat_rightbar_open` como "ainda não definida" quando ausente e, no desktop, abrir por padrão. Opcionalmente, limpar o valor legado gravado durante o ajuste anterior (migração simples de chave, ex.: passar a usar `chat_rightbar_open_v2`) para que todos voltem ao padrão aberto no desktop.

## Fora de escopo

- Layout, campos, abas ou dados dos painéis Contato/CRM.
- Comportamento mobile (segue como sheet).
