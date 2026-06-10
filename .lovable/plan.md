# Central de Ajuda no tema do sistema (sem dark forçado)

A experiência Netflix permanece igual (hero rotativo, carrosséis horizontais, cards com hover/zoom) — apenas a paleta deixa de ser escura fixa e passa a usar os tokens do tema do sistema, ficando idêntica ao restante da plataforma (claro hoje, e escuro automaticamente se o modo escuro for ativado no futuro).

## O que muda

**Página principal (`/ajuda`)**
- Fundo `bg-zinc-950` → fundo padrão do sistema (`bg-background`)
- Busca e botão Studio: cores zinc fixas → tokens (`bg-card`, `border-border`, `text-foreground`, placeholders em `muted-foreground`)
- Títulos das trilhas/carrosséis: branco fixo → `text-foreground`

**Hero (destaques)**
- Mantém os overlays escuros em gradiente **sobre a imagem** (necessário para legibilidade do texto branco sobre fotos — padrão Netflix), mas o degradê inferior passa a fundir com `background` em vez de preto, integrando com a página clara
- Botões e badges ajustados para contraste em ambos os temas

**Cards e carrosséis (HelpPostCard / HelpRow)**
- Placeholder sem capa: zinc fixo → `bg-muted`
- Ring/hover: branco fixo → `ring-border` / `ring-primary`
- Títulos e metadados: tokens `foreground` / `muted-foreground`
- Setas de navegação dos carrosséis com fundo `background/80` + blur

**Página do post (`/ajuda/post/:slug`)**
- Fundo, estados de loading/erro e textos → tokens do tema
- Banner de capa mantém overlay escuro sobre a imagem, fundindo com `background`
- Conteúdo: `prose prose-invert` → `prose dark:prose-invert`, links em `text-primary`

**Sem mudanças** no Studio (já usa o tema do sistema), banco de dados, permissões ou lógica.

## Detalhes técnicos

- Arquivos editados: `HelpCenterPage.tsx`, `HelpPostPage.tsx`, `HelpHero.tsx`, `HelpPostCard.tsx`, `HelpRow.tsx`
- Remoção dos wrappers `bg-zinc-950 -m-4 lg:-m-6` (mantendo o full-bleed apenas se necessário para o hero, agora com `bg-background`)
- Substituição sistemática de classes fixas (`zinc-*`, `text-white`, `bg-black`) por tokens semânticos (`background`, `foreground`, `card`, `muted`, `border`, `primary`)
- Overlays sobre imagens permanecem escuros por legibilidade; gradientes de transição usam `from-background`