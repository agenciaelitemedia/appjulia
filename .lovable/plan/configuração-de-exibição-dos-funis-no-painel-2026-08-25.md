# Configuração de exibição dos funis no painel

## Objetivo
Adicionar, ao lado do botão "Atualizar" do painel, um botão com ícone de engrenagem que abre um menu para escolher como os três funis são exibidos, salvando a preferência do usuário no navegador.

## Comportamento
- Botão de configurações (ícone de engrenagem) à direita do botão "Atualizar", mesmo tamanho e estilo (outline, ícone apenas).
- Ao clicar, abre um menu com duas opções (marcação de qual está ativa):
  - **Padrão (3 colunas)** — os funis Julia, Campanhas e Orgânicos lado a lado (comportamento atual).
  - **Full (1 por linha)** — cada funil ocupa a largura total, um abaixo do outro.
- A escolha é aplicada imediatamente e persistida em `localStorage`, sendo restaurada em todo novo acesso à tela.

## Detalhes técnicos
- `src/lib/constants.ts`: nova chave `DASHBOARD_FUNNEL_LAYOUT` em `STORAGE_KEYS`.
- `src/pages/Dashboard.tsx`: estado `funnelLayout` (`'grid' | 'full'`) inicializado a partir do `localStorage` (fallback `'grid'`), gravado a cada mudança; `DropdownMenu` com `DropdownMenuRadioGroup` no botão de engrenagem; prop `layout` repassada ao `DashboardTripleFunnel`.
- `src/pages/dashboard/components/DashboardTripleFunnel.tsx`: aceita `layout?: 'grid' | 'full'` e alterna as classes do container entre `lg:grid-cols-3` e `grid-cols-1`.
- Sem mudanças de dados, hooks ou backend.
