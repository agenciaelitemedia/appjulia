

# Padronizar Módulo de Telefonia no Sistema de Módulos

## Problema
O módulo de telefonia não está registrado no sistema de permissões (`ModuleCode`) e não possui um hook `useEnsure` para garantir sua presença no menu. A rota admin usa `module="admin_agents"` ao invés de um módulo próprio.

## Alterações

### 1. `src/types/permissions.ts`
Adicionar `'telephony_admin'` e `'telephony'` ao tipo `ModuleCode`.

### 2. Criar `src/hooks/useEnsureTelefoniaModule.ts`
Hook seguindo o padrão de `useEnsureCopilotModule` e `useEnsureMonitoramentoModule`:
- Código admin: `telephony_admin`, rota `/admin/telefonia`, grupo `ADMINISTRATIVO`, ícone `Phone`, display_order ~57
- Código usuário: `telephony`, rota `/telefonia`, grupo `SISTEMA`, ícone `Phone`, display_order ~35

### 3. `src/components/layout/Sidebar.tsx`
Importar e chamar `useEnsureTelefoniaModule()`.

### 4. `src/App.tsx`
- Rota `/admin/telefonia`: trocar `module="admin_agents"` por `module="telephony_admin"`
- Rota `/telefonia`: envolver com `<ProtectedRoute module="telephony">`

### 5. `src/lib/iconMap.ts`
Garantir que `Phone` está mapeado (se ainda não estiver).

