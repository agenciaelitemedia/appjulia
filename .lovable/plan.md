# Cor principal mais escura, alinhada ao header/sidebar

Hoje o `--primary` do conteúdo claro é um magenta vibrante (`330 78% 48%`), que briga com o chrome escuro (base violeta/ameixa `258 34% 8%` com degradês magenta/violeta). A ideia é aprofundar o tom principal para uma ameixa/magenta escuro que converse com o header e a sidebar, e trazer o efeito de degradê + vitrificação para os elementos principais.

## 1. Novo tom principal (light)

- `--primary`: magenta escuro/ameixa (aprox. `322 62% 34%`) — mesma família do chrome, contraste alto com texto branco.
- `--ring` e `--sidebar-primary` (light) alinhados ao novo tom.
- `--brand-magenta` levemente mais fechado no light (aprox. `326 70% 40%`) para os degradês não estourarem; `--brand-violet` mantém a família (aprox. `262 62% 42%`).
- `--gradient-brand` no light passa a ir de ameixa escura → violeta profundo, o mesmo eixo visual do header.
- Dark permanece com os tons atuais mais luminosos (legibilidade sobre fundo escuro).

## 2. Degradê + vitrificação nos elementos principais

- Nova utilitária `.aj-glass-primary`: degradê da marca + brilho interno superior (`inset 0 1px 0 hsl(0 0% 100% / .18)`), borda translúcida e sombra suave da marca — mesmo acabamento do item ativo da sidebar.
- Aplicar em:
  - Botões `variant="default"` (Button) — degradê no lugar da cor plana, com hover levemente mais claro e `active` mais fechado.
  - Badges/abas ativas que hoje usam `bg-primary` plano nos cabeçalhos de página.
- Manter `:focus-visible` com `--ring` para acessibilidade.

## 3. Garantias

- Nenhuma cor hardcoded nova em componentes; tudo por token/utilitária.
- Sem mudança em light/dark toggle, layout, lógica ou dados.
- Conferir contraste em: botões primários, abas do Chat, totalizadores do CRM, badges e o card de login (que segue com o bloco `.aj-login` isolado, intocado).

## Detalhes técnicos

- Arquivos: `src/index.css` (tokens light + utilitária de vidro), `src/components/ui/button.tsx` (apenas a variante `default` recebe as classes de degradê/vidro).
- `tailwind.config.ts` não muda — os tokens já existem.
