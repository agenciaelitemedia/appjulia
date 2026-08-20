# Contraste, foco/acessibilidade e refino visual das páginas internas

Objetivo: elevar legibilidade e consistência do painel com a identidade do `/login`, com foco especial nos cabeçalhos de colunas dos kanbans (degradê + vidro), sem alterar lógica de negócio.

## 1. Contraste e tokens (light e dark)

- Ajustar em `src/index.css` os tokens de baixo contraste:
  - `--muted-foreground` (light) um pouco mais escuro para passar AA em textos pequenos (subtítulos, metadados de cards).
  - `--border`/`--input` levemente mais definidos no light, para cards e inputs não "desaparecerem" no fundo claro.
  - `--accent-foreground` e `--secondary-foreground` verificados sobre seus fundos.
- Manter `--primary` (ameixa escura) como está; garantir que texto branco sobre ele fique AA em botões e badges.
- Nenhum token existente será removido (`flow-*`, `chart-*`, `sidebar-*`, `brand`).

## 2. Foco visível e acessibilidade

- Novo padrão de anel de foco em `src/index.css`: `.aj-focus-ring` (anel duplo — halo da marca + contorno de contraste), aplicado via classes utilitárias nos primitivos.
- Atualizar os primitivos shadcn para o novo anel, sem mudar API: `button`, `input`, `textarea`, `select`, `tabs`, `switch`, `checkbox`, `dropdown-menu`, `dialog` (close).
- Garantir foco visível também em elementos custom que hoje não têm: alça de arrastar da coluna do kanban (`PipelineColumn`), cards clicáveis do kanban e dos boards.
- A alça de arrastar hoje fica `opacity-0` até o hover — passará a aparecer também em `focus-visible` (hoje é invisível para teclado).
- `aria-label` nos botões só-ícone dos kanbans (menu da coluna, ações do card) e `aria-label` na coluna como região.
- Alvos de toque: subir botões `size="icon"` críticos para `min-h-11 min-w-11` no mobile.

## 3. Kanbans com cabeçalho em degradê/vidro

Novas utilidades em `src/index.css`:
- `.aj-column-head`: superfície de vidro (blur + borda translúcida + brilho interno superior) que usa a cor da etapa como tinta, via `--stage-color` em vez do `backgroundColor: color20` atual.
- `.aj-column-shell`: coluna com fundo suave, borda hairline e sombra baixa.
- `.aj-title-gradient`: título da etapa/board com degradê da cor da etapa para o violeta da marca (com fallback de cor sólida para navegadores sem `background-clip: text`).
- `.aj-drop-active`: realce da coluna ao receber card (borda em degradê + glow), substituindo o estado de hover atual.

Aplicar em:
- `src/pages/crm-builder/components/pipeline/PipelineColumn.tsx` (cabeçalho, barra de total, estado de drop).
- `src/modules/notificacoes-alertas/components/CrmNotificacoesTab.tsx` (colunas do CRM de Notificações).
- `src/pages/tickets/components/TicketsKanban.tsx` (colunas do helpdesk).
- `src/modules/escritorios/components/OfficeCrmTab.tsx` (colunas do CRM do escritório).

Cards (`DealCard`, `AlertCrmLeadCard`, `BoardCard`, `TaskCard`) recebem borda hairline + hover com leve elevação e glow da marca, mantendo estrutura e handlers.

## 4. Títulos e cabeçalhos das páginas internas

- Padronizar títulos `h1` das páginas internas com um leve degradê da marca e subtítulo em `text-muted-foreground` corrigido (ex.: `CRMHeader`, cabeçalho do board, Tickets, Notificações e Alertas).
- Cartões de resumo (`BoardSummaryCards`, totalizadores) passam a usar tokens em vez de cores fixas (`bg-emerald-100`, `text-blue-600`, etc.), que hoje quebram no dark.

## 5. Verificação

- Revisão visual em light e dark: CRM Builder (board), CRM de Notificações, Tickets, Chat, Dashboard, Escritórios.
- Navegação por teclado (Tab) nas colunas e cards dos kanbans conferindo foco sempre visível.
- Checagem de contraste dos pares de texto/fundo ajustados.

## Detalhes técnicos

- Arquivos: `src/index.css` (tokens + utilidades), primitivos em `src/components/ui/*`, os quatro componentes de coluna de kanban, cards citados e cabeçalhos de página.
- Sem novas dependências, sem mudanças em hooks de dados, edge functions ou banco.
- Nenhuma cor hardcoded nova; a cor por etapa continua vinda do banco, injetada como CSS var.
