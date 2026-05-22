## Alterações em `src/components/chat/ChatList.tsx`

### 1. Renomear abas de status (linha ~1504)
- `'Em Abertos'` → **`'Aguardando Atendimento'`**
- `'Em Atendimento'` → **`'Meus Atendimentos'`**

### 2. Realce colorido por aba selecionada
Substituir o estilo atual (`border-primary text-primary` + badge `bg-primary`) por cores específicas:

- **Aguardando Atendimento (pending)** selecionada → borda + texto + badge em **amarelo** (`border-amber-500 text-amber-600`, badge `bg-amber-500 text-white`).
- **Meus Atendimentos (open)** selecionada → borda + texto + badge em **verde** (`border-emerald-500 text-emerald-600`, badge `bg-emerald-500 text-white`).
- **Resolvidas/Encerradas** mantém o estilo neutro atual.

### 3. Fundo suave da lista de contatos conforme aba (linha ~1539)
Aplicar uma cor de fundo bem suave ao container `<div ref={listRef} className="flex-1 overflow-y-auto">` de acordo com `conversationStatusFilter`:
- `pending` → `bg-amber-50/40` (dark: `bg-amber-950/10`)
- `open` → `bg-emerald-50/40` (dark: `bg-emerald-950/10`)
- `resolved_closed` → sem tint (mantém `bg-background`)

### 4. Renomear atalhos do select de atendente (linhas 1332–1336)
- `'Todos atendentes'` → **`'Todos Atendimentos'`**
- `'Sem atendente'` → **`'Aguardando Atendimento'`**
- `'Meus atendimentos'` permanece.

### 5. Esconder lista de membros da equipe para não-donos
Apenas o "dono do escritório" pode ver a lista completa de atendentes no select; demais usuários só veem os 3 atalhos.

Critério de dono: `isAdmin || user?.role === 'user'` (papel principal/proprietário da conta — mesmo critério já usado em outras partes do ChatList para diferenciar a conta dona).

Implementação: passar `members={isOwner ? teamMembers : []}` para `<TeamMemberSelect>`. Os `extraOptions` continuam aparecendo para todos.

## Observações
- Mudanças puramente de UI/labels; nenhuma lógica de filtragem, permissões reais ou backend é alterada.
- As cores usam classes Tailwind padrão (amber/emerald) coerentes com o restante do app (já usadas em `ContactDetailPanel`/`ChatHeader` para indicar status "em atendimento").
- Nenhuma migração ou alteração de tipo necessária.
