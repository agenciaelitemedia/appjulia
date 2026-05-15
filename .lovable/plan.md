## Objetivo

Evoluir o módulo de Tarefas para suportar:

1. Categorias persistidas em banco por escritório (client_id).
2. Itens (subtarefas) obrigatórios em templates e tarefas.
3. Regras de fluxo: iniciar tarefa → concluir/cancelar itens → conclusão automática + pontuação.
4. Permissões de edição restritas a admin, user e colaborador.

---

## 1. Banco de dados (nova migration)

### 1.1 Tabela `task_categories`

- `id uuid pk`, `client_id text not null`, `name text not null`, `color text default '#6366f1'`, `is_active boolean default true`, `created_by text`, `created_at`, `updated_at`.
- Unique parcial: `(client_id, lower(name)) where is_active`.
- Índice em `client_id`.
- RLS aberta no padrão do módulo (`task_categories_all`), igual demais tabelas (`tasks_all`).
- Seed: ao primeiro acesso de cada client_id sem categorias, inserir presets atuais (Comercial, Suporte, Financeiro, Jurídico, Operacional, Marketing) — feito client-side via hook `useEnsureDefaultCategories`.

### 1.2 Substituir coluna livre `category` por FK

- `ALTER TABLE tasks ADD COLUMN category_id uuid REFERENCES task_categories(id) ON DELETE SET NULL`.
- `ALTER TABLE task_templates ADD COLUMN category_id uuid REFERENCES task_categories(id) ON DELETE SET NULL`.
- Backfill: criar categorias automáticas a partir dos valores distintos atuais de `category` por `client_id` e popular `category_id`.
- Manter `category` (texto) por compatibilidade temporária; ler preferindo o nome do join.

### 1.3 Tabela `task_template_items`

- `id uuid pk`, `template_id uuid not null references task_templates(id) on delete cascade`, `client_id text not null`, `title text not null`, `description text`, `position int not null default 0`, `created_at`, `updated_at`.
- Índice em `(template_id, position)`.
- RLS no padrão (`task_template_items_all`).

### 1.4 Tabela `task_items`

- `id uuid pk`, `task_id uuid not null references tasks(id) on delete cascade`, `client_id text not null`, `template_item_id uuid null references task_template_items(id) on delete set null`, `title text not null`, `description text`, `position int not null default 0`, `status text not null default 'pending' check status in ('pending','completed','cancelled')`, `completed_at`, `completed_by`, `cancelled_at`, `cancelled_by`, `created_at`, `updated_at`.
- Índices: `(task_id, position)`, `(client_id, status)`.
- RLS aberta (`task_items_all`).

### 1.5 Trigger de auto-conclusão de tarefa

- Função `fn_task_auto_complete_from_items()`:
  - Em `AFTER UPDATE` de `task_items`, recalcular para `task_id`:
    - se a tarefa estiver `in_progress` E todos os itens não-cancelados estiverem `completed` E houver pelo menos 1 item não-cancelado → `UPDATE tasks SET status='completed'` (dispara `fn_task_complete_points` existente, que credita pontos).
- Trigger no insert/update/delete de `task_items` chamando essa função.

### 1.6 Ajuste em `fn_task_complete_points`

- Manter a regra: pontos só são creditados quando `status` muda para `completed`. Nenhuma mudança estrutural; apenas garantir que a transição via auto-complete passa pelo trigger `BEFORE UPDATE` existente (passa).

### 1.7 Validação para impedir conclusão manual sem itens

- Função trigger `fn_validate_task_completion()` `BEFORE UPDATE` em `tasks`:
  - Se `NEW.status = 'completed'` e existir algum item em `pending` → `RAISE EXCEPTION`.
  - Se a tarefa tem 0 itens ainda → permitir conclusão manual (compat para tarefas legadas sem itens).

---

## 2. Hooks (frontend)

### 2.1 `useTaskCategories.ts` (novo)

- `list()` por `client_id`, `create`, `update`, `archive` (soft delete via `is_active`).
- React Query com realtime channel em `task_categories`.
- `ensureDefaults()` que insere os presets se a lista vier vazia (idempotente por nome).

### 2.2 `useTaskTemplates.ts` (atualizar)

- Estender `TaskTemplateInput` com `category_id` e `items: { title; description?; position }[]`.
- `create/update` em transação lógica:
  - upsert template, depois `delete from task_template_items where template_id` + reinsert (estratégia simples).
- Validar no client: pelo menos 1 item.

### 2.3 `useTaskItems.ts` (novo)

- `list(taskId)`, `complete(itemId)`, `cancel(itemId)`, `reopen(itemId)`, `addItem`, `updateItem`, `removeItem`.
- `removeItem` bloqueado se `task.status !== 'pending'`.
- Realtime no `task_items` filtrado por `task_id`.

### 2.4 `useTasks.ts` (atualizar)

- `createFromTemplates`: após criar tarefas, copiar `task_template_items` → `task_items` (`template_item_id` populado).
- `updateStatus`:
  - Bloquear conclusão manual via UI (botão de concluído sai da tarefa).
  - Manter `start` (pending → in_progress) e `cancel`.
- Adicionar campo `category_id` no insert/select e expor `category_name` via join.

---

## 3. UI

### 3.1 Aba “Configurações” (`TasksConfigTab.tsx`)

- Nova seção “Categorias”: lista + criar/editar/arquivar com nome e cor. Usa `useTaskCategories`.
- Form de Template (`TaskTemplateForm.tsx`):
  - Substituir chips de categoria preset por `<Select>` populado de `task_categories` (com botão “+ Nova categoria” inline).
  - Adicionar editor de **Itens da Tarefa** (lista reordenável simples com drag opcional ou setas):
    - Campo título obrigatório, descrição opcional.
    - Botão “Adicionar item”.
    - Validação: salvar só com ≥ 1 item.
- Permissões: a aba Configurações continua restrita a admin (já é). Edição de templates segue regra atual.

### 3.2 Lista de tarefas (`TasksListTab.tsx` + `TaskCard.tsx`)

- Card mostra:
  - Categoria (badge usando cor de `task_categories`).
  - Botão **Iniciar** (quando `pending`) → muda para `in_progress`.
  - Quando `in_progress`: lista de itens expansível, cada item com botões **Concluir** e **Cancelar** (ícones); admins podem **Reabrir**.
  - Sem botão “Concluir” na tarefa — conclusão é automática quando todos os itens não-cancelados estão concluídos.
  - Botão **Cancelar tarefa** (admin/criador).
  - Indicador “x/y itens” de progresso.
- Botão **Excluir item** disponível só se `task.status === 'pending'` (a regra também é garantida no hook).
- Botões de Editar/Excluir tarefa visíveis apenas para perfis `admin`, `user`, `colaborador` (via `AuthContext.hasPermission` ou checagem direta de role).

### 3.3 Diálogo `AddRankedTasksDialog`

- Pré-visualização mostra a quantidade de itens que cada template vai gerar.
- Após criar tarefas, navegar/abrir a primeira para confirmar itens.

---

## 4. Permissões

- Centralizar verificação em util `canManageTask(user)`: retorna true para roles `admin`, `user`, `colaborador`.
- Aplicar em:
  - Botões editar/excluir tarefa.
  - Edição de template (mantém atual).
  - Gerenciar categorias (somente admin — manter padrão da aba Config).
- Marcar item como concluído/cancelado: qualquer responsável pela tarefa OU `canManageTask`.

---

## 5. Realtime e cache

- Adicionar `task_items` e `task_categories` ao `supabase_realtime` publication.
- Hooks invalidam queries de `tasks` ao receber evento de `task_items` (para refletir progresso).

---

## 6. Migração de dados existentes

- Script dentro da migration:
  1. Para cada `client_id` com tarefas/templates, criar categorias a partir dos valores distintos não-nulos de `category`.
  2. Atualizar `task_templates.category_id` e `tasks.category_id` correspondentes.
  3. Para tarefas sem itens, NÃO criar item automático — a regra de “todos os itens concluídos” só vale quando há itens; a validação trigger libera conclusão manual nesse caso (compat).

---

## 7. Entregáveis (ordem)

1. Migration: tabelas, FKs, triggers, backfill.
2. Hooks novos/atualizados.
3. UI Config (categorias + items no template).
4. UI Lista (itens, fluxo iniciar/concluir item).
5. Ajustes de permissões.
6. QA: criar template com itens → criar tarefa → iniciar → concluir itens → ver pontuação no ranking.

---

## Pontos a confirmar

- Roles exatos no sistema: hoje há `admin`, `user`, `colaborador`,  time,`advogado`? (Preciso confirmar para ajustar `canManageTask` — assumo os 3 que você citou.)
- Cancelar todos os itens deve concluir a tarefa ou cancelá-la? Plano atual: se TODOS os itens forem cancelados (nenhum concluído), a tarefa a tarefa e marcada como cancelada também.