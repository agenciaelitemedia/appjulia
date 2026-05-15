## Objetivo

No painel "Tarefas Rankeadas" do CRM (dentro do card do deal):
1. Mostrar **apenas tarefas que tenham itens** cadastrados.
2. Permitir **expandir** uma tarefa clicando nela para ver a lista de itens.
3. Colocar o botão **"Iniciar tarefa"** logo no topo da área expandida (antes da lista de itens), para que o usuário possa marcar os itens como concluídos.

## Mudanças

### 1. `src/hooks/useTasks.ts` — incluir contagem de itens

Na query do `useTasks` (que retorna `rankedTasks`), trazer também o count de `task_items` por tarefa para podermos filtrar sem fazer N requests.

```ts
.select('*, task_items(count)')
```

E expor `items_count` no tipo `Task` (campo derivado).

### 2. `src/pages/crm-builder/components/deals/DealTasksPanel.tsx`

- Filtrar `sortedRankedTasks` para conter somente tarefas com `items_count > 0`.
- Trocar o uso atual `<TaskCard ... compact />` por `<TaskCard ... />` (modo não-compacto) **ou** ativar a expansão também no modo compacto (ver mudança abaixo no TaskCard). Prefiro manter `compact` mas habilitar expansão.
- Mensagem de vazio passa a dizer: "Nenhuma tarefa rankeada com itens".

### 3. `src/pages/tarefas/components/TaskCard.tsx`

- Permitir clique no cabeçalho da tarefa para alternar `expanded` (mesmo em `compact`).
- Renderizar `TaskItemsPanel` também em modo compacto quando `expanded === true`.
- Mover o botão **"Iniciar tarefa"** para dentro do bloco expandido, posicionado **acima** da lista de itens (antes do `TaskItemsPanel`), visível apenas se `task.status === 'pending'` e o usuário puder agir. O botão atual fora da expansão é removido (ou mantido apenas como fallback no modo não-compact, a definir abaixo).
- Adicionar um chevron / indicador visual de "clique para expandir" no compact.

### 4. `src/pages/tarefas/components/TaskItemsPanel.tsx` (opcional)

Adicionar prop opcional `headerSlot?: ReactNode` para renderizar o botão "Iniciar tarefa" dentro do painel, ou simplesmente renderizar o botão no `TaskCard` antes de `<TaskItemsPanel />` (mais simples — vamos por essa).

## Comportamento final

- Lista de Tarefas Rankeadas só mostra tarefas com itens.
- Clique no card → expande mostrando:
  1. Botão "▶ Iniciar tarefa" (se ainda `pending`).
  2. Lista de itens (com checkboxes habilitados apenas após `in_progress`).
- Quando todos os itens são concluídos, a tarefa fecha automaticamente (trigger já existente).

## Arquivos

- Editar: `src/hooks/useTasks.ts`
- Editar: `src/pages/crm-builder/components/deals/DealTasksPanel.tsx`
- Editar: `src/pages/tarefas/components/TaskCard.tsx`

Sem mudanças de banco de dados.