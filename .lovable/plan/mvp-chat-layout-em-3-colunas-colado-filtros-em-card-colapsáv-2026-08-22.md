# /mvp-chat: layout em 3 colunas colado, filtros em card colapsável

Só o módulo `/mvp-chat`. O `/chat` não é tocado.

## 1. Layout em 3 colunas, sem folga entre elas

Estrutura igual em espírito à do `/chat`: colunas encostadas, separadas apenas por borda hairline, sem `gap` e sem padding externo.

```text
+------------------+---------------------------+----------------+
| Lista (350px)    | Conversa (flex-1)         | Detalhes (320) |
| filtros + cards  | header + payload/preview  | contato/CRM    |
+------------------+---------------------------+----------------+
```

- Container raiz: altura cheia, `flex`, `overflow-hidden`, sem `gap-4`; bordas internas (`border-r`) fazem a separação.
- Coluna 1: largura fixa 350px, cabeçalho compacto, filtros colapsados, contadores, lista com scroll fino (`thin-scrollbar`).
- Coluna 2: barra de status (tempo real / atualizando / recarregar) + painel de performance + detalhes da conversa selecionada.
- Coluna 3 (nova): painel de detalhes da conversa selecionada (contato, fila, responsável, SLA, etapa CRM, ticket), 320px, oculto abaixo de `xl`; mostra estado vazio quando nada está selecionado.
- Mobile/tablet: colunas 2 e 3 colapsam — a lista ocupa a tela e a seleção abre o painel principal.

## 2. Filtros em card colapsável

- A barra de filtros passa a viver dentro de um `Collapsible` fechado por padrão, ocupando só uma linha de cabeçalho: ícone de filtro, texto "Filtros", contador de filtros ativos e botão "Limpar" (visível apenas quando há filtro ativo).
- Fechado, a lista ganha praticamente toda a altura da coluna.
- Aberto, o conteúdo tem altura máxima própria com rolagem fina, sem empurrar a lista para fora da tela.
- A busca fica sempre visível fora do collapsible (é o filtro mais usado), com botão de limpar.

## 3. Filtros: navegabilidade, usabilidade e acessibilidade

- Organização em grupos rotulados: **Situação** (status, tipo, prioridade, modo), **Período e ordenação**, **Marcadores** (sem responsável, com ticket, CRM Builder, Meta Ads, SLA), **Responsáveis**, **Etapas CRM da Júlia**, **Filas**, **Etiquetas**.
- Selects em grade responsiva (2 colunas em telas estreitas), todos com `label` associado por `id`/`htmlFor`.
- Chips de múltipla escolha passam de `Badge` clicável para botões reais (`<button type="button" role="checkbox" aria-checked>`), navegáveis por Tab, acionáveis por Enter/Espaço e com anel de foco padrão do projeto (`aj-focus-ring`).
- Grupos com muitas opções (responsáveis, filas, etiquetas) ganham `role="group"` + `aria-label` e limite de exibição com "ver mais/ver menos".
- Resumo dos filtros ativos como chips removíveis no topo do card (cada um com `aria-label` "Remover filtro X"), para o usuário saber o que está aplicado com o card fechado.
- Contagem de resultados anunciada em região `aria-live="polite"` discreta.

## Detalhes técnicos

- Arquivos: `src/modules/mvp-chat/pages/MvpChatPage.tsx` (grid de 3 colunas), `src/modules/mvp-chat/components/MvpChatFilters.tsx` (collapsible, grupos, chips acessíveis) e um novo `src/modules/mvp-chat/components/MvpChatDetailsPanel.tsx` (coluna 3).
- Reexportar `Collapsible`/`Label` em `src/modules/mvp-chat/extend/ui.ts` se ainda não estiverem lá.
- Nenhuma mudança em hooks de dados, na edge function, no SQL ou em `src/components/chat/*`.
- Sem cores hardcoded: apenas tokens semânticos existentes.
