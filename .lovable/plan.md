# Alinhar Kanban de Chamados ao padrão do CRM

## Diagnóstico das diferenças atuais

Comparando `src/pages/tickets/components/TicketsKanban.tsx` com o CRM (`crm-builder/components/pipeline/PipelineColumn.tsx` + `deals/DealCard.tsx`):

| Item | CRM (referência) | Chamados (hoje) |
|---|---|---|
| Largura da coluna | 280px | 260px |
| Container da coluna | `bg-muted/30 rounded-lg` envolvendo header + corpo + footer | só o corpo tem `bg-muted/30`, header solto |
| Header da coluna | Faixa colorida (cor da etapa em 20% opacity), nome, badge de contagem, menu “…” | apenas Badge de status + número solto |
| Barra de stats | Linha “Total: …” quando aplicável | inexistente |
| Footer da coluna | Botão “+ Adicionar Card” fixo no rodapé | inexistente |
| Paginação | 30 cards por vez + “Ver mais (N)” + “Exibindo X de Y” | renderiza todos |
| Drop area | `min-h-[300px]`, ring no `isOver` | `min-h-[120px]`, ring no `isOver` |
| Card | `Card` shadcn com `border-l-4` colorida (cor da etapa), `p-3 space-y-2`, ações inline (Phone/Chat), menu “…” no hover, badges de prioridade/responsável/SLA, tags | div básica com título + 2 badges, sem borda colorida, sem ações inline, sem menu |
| Scroll | `overflow-x/y-auto scrollbar-none` + `pb-20` (já aplicado nos chamados) | OK ✅ |

## O que será feito

Tudo no diretório `src/pages/tickets/components/` — sem mexer em dados, hooks ou regras de negócio.

### 1. `TicketsKanban.tsx` — Column

Reescrever o `Column` espelhando `PipelineColumn`:

- Wrapper: `flex-shrink-0 min-w-[280px] max-w-[280px] flex flex-col bg-muted/30 rounded-lg`
- **Header tintado** usando a cor do status (derivada de `STATUS_BADGE[status]` → mapa de cor sólida por status, ex.: `open=blue`, `in_progress=amber`, `waiting=violet`, `resolved=emerald`): `p-3 rounded-t-lg` com `backgroundColor: cor + '20'`, contendo:
  - bolinha colorida 3×3
  - `h3` com `STATUS_LABEL[status]`
  - `Badge secondary` com `tickets.length`
  - (sem grip — colunas não são reordenáveis no suporte)
- **Barra de stats opcional**: contagem de atrasados (SLA vencido) com ícone de alerta quando > 0 — usa o mesmo helper já existente no `TicketSlaBadge`. Se preferirmos manter simples na v1, omitimos e ficam só nome + contagem.
- **Área de drop**: `flex-1 p-2 min-h-[300px]`, `space-y-2`, ring `ring-2 ring-primary bg-primary/10` em `isOver`.
- **Paginação**: estado `visibleCount` (default 30), botão “Ver mais (N)” + “Exibindo X de Y” idêntico ao CRM.
- **Footer**: botão `ghost` “+ Novo chamado nesta etapa” que abre o `NewTicketDialog` já existente com `defaultStatus={status}` (precisa aceitar prop — fallback: abre sem default e o agente escolhe).

### 2. `TicketsKanban.tsx` — TicketCard

Reescrever usando `Card`/`CardContent` shadcn, espelhando `DealCard`:

- `Card` com `border-l-4` cuja cor vem do status (mesmo mapa do header) — destaque visual idêntico ao CRM.
- `CardContent className="p-3 space-y-2"`.
- **Linha 1 (header do card)**:
  - `#numero` em mono + título `line-clamp-2 font-medium text-sm flex-1`.
  - Ícones de ação inline (mesmo estilo do CRM, `h-7 w-7 ghost`, com `stopPropagation`):
    - `MessageCircle` verde quando `ticket.conversation_id` (abrir conversa vinculada).
    - `Eye` para abrir detalhe (substitui o clique no card inteiro, mantendo arraste seguro).
  - Menu “…” aparecendo no hover (`opacity-0 group-hover:opacity-100`) com: Editar prioridade, Resolver, Fechar.
- **Linha 2 (meta)**: `User` + nome do solicitante.
- **Linha 3 (badges, flex-wrap)**: prioridade, responsável (se houver), `TicketSlaBadge` compacto, badge de fila (se houver `queue_id`).
- Hover `hover:shadow-md transition-all`, drag `opacity-30 ring-2 ring-primary/50 ring-dashed`.

### 3. Container externo

Já está alinhado (scroll oculto + `h-full`). Apenas aumentar `gap-3 → gap-4` para casar com o CRM e adicionar `p-1` no wrapper interno para o ring de drop respirar.

### 4. Helper de cor por status

Criar pequeno mapa local no `TicketsKanban.tsx`:
```ts
const STATUS_COLOR: Record<TicketStatus,string> = {
  open: '#3b82f6', in_progress: '#f59e0b',
  waiting: '#8b5cf6', resolved: '#10b981',
};
```
Usado tanto no header tintado quanto na borda esquerda do card.

## Fora de escopo

- Não alterar `useTickets`, mutations, regras de SLA, fluxo de resposta/notas nem persistência.
- Não tornar colunas reordenáveis (status é enum fixo).
- Não mexer nas abas Lista/Dashboard/Configurações.

## Resultado esperado

Visualmente idêntico ao Kanban do CRM: colunas com header colorido + contagem + footer “+ adicionar”, cards com borda colorida à esquerda, ícones de ação inline, menu no hover, paginação “Ver mais” e barra de scroll oculta — mantendo 100% do comportamento de drag-and-drop e dados atuais.