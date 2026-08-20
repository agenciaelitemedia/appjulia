# Painel da Julia com a identidade da nova tela de login

Objetivo: trazer a linguagem visual do novo `/login` (magenta/violeta, tipografia Sora + Plus Jakarta Sans, superfícies suaves com vidro) para o painel, em versão **light por padrão**, com uma versão **dark** equivalente e um **botão de troca light/dark no header**. A nova logo "ATENDE Julia" passa a ser sempre bem visível no header.

## 1. Tema (design system)

- Migrar as cores da marca do login para tokens globais em `src/index.css` (`:root` e `.dark`), em HSL:
  - `--primary` = magenta da marca (330 92% 60% no dark, tom levemente mais fechado no light para contraste de texto branco), `--ring`, `--accent`, `--sidebar-primary` alinhados.
  - novos tokens: `--brand-magenta`, `--brand-violet`, `--gradient-brand`, `--shadow-brand`, `--surface-glass`.
  - light: fundo levemente frio (não branco puro), cards brancos, bordas suaves.
  - dark: base do login (`258 32% 6%` fundo, `260 26% 12%` superfície), sidebar mais escura que o conteúdo.
- Expor os novos tokens em `tailwind.config.ts` (`colors.brand.magenta/violet`, `backgroundImage.brand`, `boxShadow.brand`) — sem remover nenhum token existente (`flow-*`, `chart-*`, `sidebar-*`, `brand`), para não quebrar telas atuais.
- Definir a fonte do app: `Sora` para títulos (`h1..h3`) e `Plus Jakarta Sans` como `font-sans`, aproveitando as fontes já carregadas no `index.html`.
- O bloco `.aj-login` continua isolado e intocado.

## 2. Troca light/dark

- Adicionar `ThemeProvider` (`next-themes`, já instalado — hoje só o Sonner o consome) no topo do app, com `attribute="class"`, `defaultTheme="light"`, `storageKey` própria e `disableTransitionOnChange`.
- Novo `ThemeToggle` no `Header.tsx` (ícone Sun/Moon, mesmo padrão `Button ghost` + Tooltip dos botões já existentes), posicionado antes do alerta de som.
- Como o CSS já define `.dark` completo, todas as telas herdam o dark automaticamente; não há mudança de lógica.

## 3. Header

- Trocar a marca no header: exibir a logo `atende-julia-logo.png` à esquerda (após os toggles), com altura fixa e boa área de respiro, sempre visível — inclusive quando a sidebar está recolhida.
- Header ganha o acabamento do login: leve blur/translucidez (`bg-background/80 backdrop-blur`), borda suave e linha de gradiente da marca no topo.
- Campo de busca e avatar reestilizados com o arredondamento do login (`rounded-full`/`rounded-xl`), mantendo comportamento e handlers atuais.

## 4. Sidebar

- Usar a nova logo no bloco de topo da sidebar (versão reduzida/ícone quando recolhida), substituindo `julia-logo.png`.
- Item ativo com fundo de marca suave + barra de destaque; hover suave. Sem alterar estrutura de grupos, permissões ou navegação.

## 5. Garantias contra quebra

- Nenhuma cor hardcoded nova em componentes; tudo por token.
- Varredura das classes hardcoded já existentes (`text-white`, `bg-white`, `bg-black`, `bg-gray-*`, `text-gray-*`) nos componentes de layout, chat e CRM; ajustar apenas as que ficariam ilegíveis no dark, trocando por tokens equivalentes.
- Revisão visual em light e dark das telas de maior tráfego: Dashboard, Chat (lista + conversa + detalhes), CRM Builder, CRM de Notificações, Telefonia, Admin.
- Nenhuma mudança em lógica de negócio, hooks de dados, edge functions ou banco.

## Detalhes técnicos

- Arquivos afetados: `src/index.css`, `tailwind.config.ts`, `src/App.tsx` (provider), `src/components/layout/Header.tsx`, `src/components/layout/Sidebar.tsx`, novo `src/components/layout/ThemeToggle.tsx`, ajustes pontuais de classes hardcoded.
- A logo é consumida via o asset já publicado (`src/assets/atende-julia-logo.png.asset.json`), mesmo padrão usado no `Login.tsx`.
- Sem novas dependências.
