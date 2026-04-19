

## Diagnóstico

Na imagem, o tempo (`há 1`, `há 2`, `há 11`) e o badge verde de não-lido estão sendo cortados/empurrados para fora do sidebar. Isso significa que o `flex-1` do nome/preview NÃO está respeitando o limite do container — está expandindo e empurrando os irmãos para fora.

### Causa raiz

Olhando `ChatContactItem.tsx` linha 153 (botão raiz):
```
className="w-full flex items-start gap-3 px-3 py-3 ... min-w-0 overflow-hidden"
style={{ maxWidth: '100%' }}
```

E o wrapper de conteúdo (linha 168): `flex-1 min-w-0 overflow-hidden space-y-1` — OK.

**Mas** dentro de Row 1 e Row 2 existe `flex items-center justify-between gap-2 min-w-0`. O problema clássico: em flexbox, `truncate` em `flex-1` só funciona se TODOS os ancestrais tiverem `min-w-0`. O botão `<button>` tem `min-w-0`, o wrapper tem `min-w-0`, a row tem `min-w-0`... então por que não funciona?

A pista está na imagem: o tempo aparece **cortado pela borda direita**, não empurrado pelo nome. Isso indica que o **próprio sidebar** está mais largo que o espaço disponível (ou que o `ChatList` interno tem padding/scrollbar comendo espaço), OU o `ChatContainer` não está realmente aplicando a largura responsiva no viewport atual (1401px = breakpoint `xl` → 500px deveria valer).

Verificando: 1401px CSS está acima do breakpoint `xl` (1280px) e abaixo de `2xl` (1536px) → sidebar = 500px. Mas a imagem mostra o sidebar parecendo maior, com conteúdo cortado à direita pela borda do painel central.

### Hipótese real

O `<button>` usa `w-full`, mas o pai (`ChatList` → provavelmente um `ScrollArea` ou `div` com scroll) pode não estar contendo a largura. Mais provável: **o problema é que dentro de Row 2, a `MessagePreview` retorna um `<span class="block truncate whitespace-nowrap">` mas está dentro de um `<div class="flex-1 min-w-0 truncate">`. O `truncate` no `<div>` não funciona quando o filho `<span class="block">` tem conteúdo longo sem quebra — o `block` do filho força largura intrínseca.**

E o nome (Row 1) usa `truncate min-w-0 flex-1 block overflow-hidden whitespace-nowrap` — mas combinado com `block` + `flex-1`, em alguns navegadores o `flex-1` calcula `flex-basis: 0%` mas o conteúdo intrínseco do `<span>` ainda empurra.

### Solução definitiva

Aplicar a técnica robusta: envolver o conteúdo truncável em um wrapper `min-w-0 flex-1` (div) e dentro colocar o `<span class="truncate block">`. Garantir `overflow: hidden` em cada nível e remover `block` redundante onde causa intrinsic sizing.

Também vou:
1. Remover `style={{ maxWidth: '100%' }}` inline (redundante com `w-full`).
2. Trocar `<span flex-1 truncate>` do nome por `<div flex-1 min-w-0 overflow-hidden><span class="truncate block">{name}</span></div>`.
3. Mesma técnica para a `MessagePreview` na Row 2.
4. Garantir que o `ChatList` container (sidebar) tenha `overflow-hidden` no wrapper e a área scrollável use `overflow-y-auto overflow-x-hidden`.

## Mudanças

### 1. `src/components/chat/ChatContactItem.tsx`
- **Row 1 (nome + tempo)**: substituir o `<span>` do nome por `<div class="flex-1 min-w-0 overflow-hidden"><span class="truncate block ...">{name}</span></div>`.
- **Row 2 (preview + unread)**: o wrapper já é `<div flex-1 min-w-0 truncate>` mas como `MessagePreview` retorna `<span class="block">`, trocar para `<div class="flex-1 min-w-0 overflow-hidden">` e dentro `<span class="truncate block">...</span>`. Ajustar `MessagePreview` para retornar conteúdo sem `block` próprio (ou envolver no chamador).
- Remover `style={{ maxWidth: '100%' }}` do `<button>`.

### 2. `src/components/chat/ChatList.tsx` (verificar)
- Confirmar que o container scrollável tem `overflow-x-hidden` para impedir overflow horizontal.

## Arquivos
- `src/components/chat/ChatContactItem.tsx`
- `src/components/chat/ChatList.tsx` (apenas se faltar `overflow-x-hidden`)

## Validação
1. Viewport 1401px: sidebar 500px, nomes longos como "Grupo AM - Advogados Associados" truncam com `…` antes do tempo.
2. Tempo (`há 25 min`) e badge verde de não-lido sempre 100% visíveis dentro da borda direita do sidebar.
3. Preview de mensagem ("Recebi", "Oii Mário...") trunca antes do badge.
4. Nenhum scroll horizontal no sidebar.

