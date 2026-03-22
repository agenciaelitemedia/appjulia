

# Telefonia: Vincular planos a cod_agent (não user_id)

## Mudança conceitual

Atualmente, `phone_user_plans` e `phone_extensions` usam `user_id`. O modelo correto é:
- O **plano** é vinculado ao **cod_agent** (agente)
- O **usuário do agente** cria ramais dentro do limite do plano do seu cod_agent

## Alterações

### 1. Migração do banco de dados

**Tabela `phone_user_plans`:**
- Renomear coluna `user_id` → adicionar coluna `cod_agent` (text, not null)
- Remover `user_id`

**Tabela `phone_extensions`:**
- Trocar `user_id` (int) por `cod_agent` (text, not null)
- Manter `assigned_member_id` para vincular a membro da equipe

### 2. Types — `src/pages/admin/telefonia/types.ts`
- `PhoneUserPlan`: trocar `user_id` por `cod_agent`
- `PhoneExtension`: trocar `user_id` por `cod_agent`

### 3. Admin — `src/pages/admin/telefonia/components/UserPlansTab.tsx`
- Input "ID do Usuário" → Input "Cod Agent"
- `assignPlan` recebe `codAgent` (string) em vez de `userId` (number)

### 4. Admin hook — `src/pages/admin/telefonia/hooks/useTelefoniaAdmin.ts`
- `assignPlan`: usar `cod_agent` em vez de `user_id`
- `userPlansQuery`: ajustar select

### 5. User hook — `src/pages/telefonia/hooks/useTelefoniaData.ts`
- Buscar plano por `cod_agent` do usuário logado (via `useAuth()` → `user.cod_agent`)
- Buscar extensions por `cod_agent`
- Criar extensions com `cod_agent`

### 6. User page — `src/pages/telefonia/TelefoniaPage.tsx`
- Adicionar seletor de agente (se o usuário tiver múltiplos agentes via `useMyAgents`)
- Passar `codAgent` selecionado para os componentes filhos

### 7. `MeusRamaisTab.tsx`
- Receber `codAgent` como prop
- Passar para o hook

### 8. `DiscadorTab.tsx`, `HistoricoTab.tsx`, `RelatoriosTab.tsx`
- Receber `codAgent` como prop para filtrar dados

