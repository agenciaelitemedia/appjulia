## Refatoração de filtros do /chat

### 1. `src/components/chat/ChatList.tsx` — área de filtros

**Remover completamente:**
- Filtro de SLA (pills "Todos SLAs / Estourado / Em risco" — linhas 884-934).
- Pills de status `Todos / Pendentes / Em atendimento / Resolvidas / Encerradas` (linhas 936-959). O controle de status passa a ser feito apenas pelas abas inferiores.
- Botão (ícone Filter) e contador `activeFilterCount` na barra de busca, pois o painel de filtros fica vazio.
- Estado `slaFilter`, `setSlaFilter`, e cálculos `breachedCount` / `atRiskCount` se não usados em outro lugar (manter `slaStatusByContact` apenas se ainda servir ao item — não serve mais; pode ser removido).
- Toda a aplicação de `slaFilter` em `applyClientFilters`, `pendingConvCount`/`openConvCount` e `visibleContacts`.
- Estado `filtersOpen` e wrappers `{filtersOpen && ...}`.

**Reorganizar a barra de filtros (sempre visível, sem painel colapsável):**

Linha 1 — período (mantém pills atuais com ícone calendário).

Linha 2 — Filas + Atendentes (lado a lado):
```
[Select Fila .................] [TeamMemberSelect Atendente ...]
```
Distribuir em `grid-cols-2 gap-2` para ficarem lado a lado, mantendo a UX atual de cada um (apenas reduzindo larguras).

Linha 3 — Modo (Todos/Julia/Humano) + Etapas, em um único bloco com destaque:
- Envolver em `<div className="flex items-center gap-2 p-2 rounded-md border border-primary/20 bg-primary/5">`.
- Modo vira `ToggleGroup` somente com **ícones**:
  - Todos → `ListFilter` (tooltip "Todos os modos")
  - Julia → `Bot` (tooltip "Filas com Julia IA ativa")
  - Humano → `User` (tooltip "Atendimento humano (Julia inativa)")
- Ao lado, o popover de etapas (mantém o componente atual, `Layers` + label `stageLabel`), envolvido em Tooltip explicativo.

**Tabs inferiores de status (atualmente `pending` e `open`):** adicionar uma terceira aba **icon-only** que cobre Resolvidas + Encerradas:
- `value: 'resolved_closed'` (novo agrupador local) com ícone `CheckCheck` (ou `Archive`) + tooltip "Resolvidas / Encerradas".
- Ao clicar, chamar `setConversationStatusFilter('resolved')` por padrão; o cálculo de `visibleContacts` para esse caso deve incluir conversas com `status === 'resolved' || status === 'closed'`.
- Ajustar `visibleContacts` (bloco `if (conversationStatusFilter !== 'pending' ...)`) para suportar o novo valor agregando os dois status no filtro `filteredContacts`. Como o contexto trabalha com `ConversationFilterStatus`, criar um filtro local que aceite ambos: derivar `visibleContacts` direto de `sortedConversations` filtrando `status in ['resolved','closed']` quando a aba estiver ativa.
- Adicionar contador da nova aba (similar a `pendingConvCount`/`openConvCount`).

### 2. `src/components/chat/ChatContactItem.tsx` — listagem

Mover blocos **Julia** (linhas 290-324) e **CRM Builder** (linhas 327-360) para **logo abaixo do preview da última mensagem (Row 2)** e **antes** da linha de pills (fila/atribuído/SLA).

Resultado da ordem dentro de `flex-1`:
1. Row 1: nome + tempo
2. Row 2: preview + unread badge
3. **NOVO posicionamento:** linha Julia (se houver) + linha CRM Builder (se houver)
4. Row 3: pills (fila → atribuído → SLA → prioridade)
5. Row 4: tags

Manter exatamente os mesmos componentes/markup, apenas reordenar.

### 3. Limpeza

- Remover imports não utilizados após a remoção: `AlertTriangle`, `Flame`, `Filter` (se nada mais usar), `FolderOpen`, `CheckCheck`/`Archive` se substituídos, etc. Re-verificar lista de imports do `lucide-react` no topo de `ChatList.tsx` e podar.
- Remover constantes `SlaFilter` type se não usado.
- Garantir `TooltipProvider` envolvendo os novos botões com `title` substituído por `Tooltip`.

### Observações técnicas

- Não alterar `WhatsAppDataContext` — toda a lógica nova fica client-side em `ChatList`.
- Para a aba "Resolvidas/Encerradas", como o contexto mantém `conversationStatusFilter: ConversationFilterStatus`, usar um estado local `statusTab: 'pending' | 'open' | 'closed_group'` e mapear:
  - `pending`/`open` → seta `setConversationStatusFilter(value)`
  - `closed_group` → seta `setConversationStatusFilter('all')` e aplica filtro client-side `status in ['resolved','closed']` no derivador `visibleContacts`. Isso evita mexer no enum do contexto.
- O contador da nova aba reaproveita o mesmo loop de `pendingConvCount`/`openConvCount` adicionando um terceiro acumulador (`closedConvCount`) sob `effectiveStatus in ['resolved','closed']`.
