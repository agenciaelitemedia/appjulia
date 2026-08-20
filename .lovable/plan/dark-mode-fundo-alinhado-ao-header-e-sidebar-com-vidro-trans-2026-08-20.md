# Dark mode: fundo alinhado ao header e sidebar, com vidro translúcido

Hoje o fundo escuro das páginas usa um degradê próprio (roxo 258 28%/26%), diferente das superfícies do header e da sidebar (`aj-shell-surface` / `aj-sidebar-surface`). A ideia é usar o mesmo padrão do chrome e deixar as superfícies internas semitransparentes, com efeito de vidro.

## O que muda

1. **Fundo das páginas igual ao do chrome**
   Reescrever o `background-image` de `.dark body` usando os mesmos hues e paradas dos gradientes do header/sidebar: base `hsl(258 34% 8%)`, glow magenta no canto superior esquerdo, glow violeta no canto superior direito e degradê vertical de `258 36% 11%` para `258 34% 7%`. Mantém `background-attachment: fixed`, então o fundo continua contínuo entre sidebar, header e conteúdo.

2. **Superfícies internas translúcidas (vidro)**
   No dark, tornar cartões e painéis semitransparentes com desfoque para o fundo aparecer:
   - `--card` e `--popover` com alpha (via uma regra `.dark .aj-glass-card` aplicada aos containers de conteúdo) ou ajuste direto nas utilidades de vidro já existentes (`aj-shell-surface`, `aj-column-shell`) para usarem alpha em vez de cor cheia.
   - Ajustar `--surface-glass` e as bordas (`--border`) para o mesmo nível de translucidez usado no header.

3. **Contêiner principal**
   Manter `dark:bg-transparent` no wrapper de conteúdo do `MainLayout` e aplicar uma camada leve de vidro (`backdrop-blur` + branco 4%) sobre o fundo, para separar o conteúdo do chrome sem escurecer.

4. **Legibilidade**
   Conferir contraste de texto sobre as superfícies translúcidas (mínimo AA para texto secundário) e reforçar a hairline superior/borda lateral já usadas no header/sidebar para delimitar as áreas.

## Detalhes técnicos

- Alterações concentradas em `src/index.css`: bloco `.dark body`, tokens dark (`--card`, `--popover`, `--border`, `--surface-glass`) e as utilidades `.aj-shell-surface` / `.aj-sidebar-surface` (extraindo os stops para variáveis `--aj-shell-*` reaproveitadas pelo body, evitando duplicação).
- Um ajuste pontual em `src/components/layout/MainLayout.tsx` para a camada de vidro do conteúdo.
- Sem mudanças no tema claro e sem alterar layout, espaçamentos ou lógica.
- Validação visual no dark mode em Chat, CRM Builder e um dashboard, comparando header/sidebar/conteúdo.
