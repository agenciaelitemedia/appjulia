# Painel de Atendimento com abas: Atendimentos / Equipe / CRM's

Transformar `/painel-atendimento` (módulo Escritórios) em uma tela com 3 abas, mantendo o módulo independente (tudo novo dentro de `src/modules/escritorios/`, consumindo recursos externos apenas via `extend/`).

## Abas

### 1. Atendimentos
Exatamente o conteúdo atual do painel (KPIs de atendimentos, mensagens, 1ª resposta, gráfico por dia, por fila, por canal, top atendentes) — apenas movido para dentro da aba, sem mudança de cálculo.

### 2. Equipe
Réplica da tela de Performance do módulo Equipe: filtros de período (Hoje/Ontem/7 dias/Mês atual/Mês anterior/Personalizado), seleção de atendentes, export CSV, 8 KPIs, gráfico de volume diário (barras empilhadas + linha de horas logadas), donut de desfechos, ranking por atendente e drawer de detalhes ao clicar na linha.

Reuso via `extend`: o módulo Escritórios passa a expor `extend/equipe.ts` reexportando o hook de performance e os componentes de tab/drawer existentes, então a aba renderiza a mesma tela sem duplicar lógica. Os dados já são escopados pelo client_id do usuário logado, então o escritório vê só a própria equipe.

### 3. CRM's
Nova visão consolidada dos quadros do CRM Builder do escritório:
- Seletor de quadro (dropdown) com opção "Todos os quadros".
- Cards de resumo: total de cards, abertos/ganhos/perdidos, valor total em aberto, valor ganho, taxa de conversão, tempo médio na etapa.
- Charts: funil por fase, tempo médio por fase, distribuição de valor por fase e um gráfico de cards por quadro (quando "Todos" estiver selecionado).
- Estado vazio amigável quando o escritório não tiver quadros.

## Detalhes técnicos

- `OfficeDashboardPage.tsx`: passa a ser um shell com `Tabs` (`atendimentos` default) + header único; o conteúdo atual é extraído para `components/OfficeAtendimentosTab.tsx`.
- `components/OfficeEquipeTab.tsx`: usa `extend/equipe.ts` → reexporta `EquipePerformanceTab` (`src/pages/equipe/components/EquipePerformanceTab.tsx`) e seus hooks; sem alterar o módulo Equipe.
- `components/OfficeCrmTab.tsx` + `hooks/useOfficeCrmAnalytics.ts`: novo `extend/crm.ts` reexportando `useCRMBoards`, `useCRMPipelines`, `useCRMDeals` e `useCRMBoardAnalytics`; client_id vem de `useOfficeClientId`.
- Charts com `recharts` (já usado no projeto) e componentes shadcn (`Card`, `Tabs`, `Select`, `Progress`); nenhuma cor hardcoded fora do padrão já existente nos charts do projeto.
- Sem migrations e sem mudanças de backend — tudo leitura sobre tabelas já existentes.
