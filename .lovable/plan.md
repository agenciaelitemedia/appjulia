

## Módulo Administrativo: Gerenciar Monitoramento

Criar uma nova página `/admin/monitoramento` seguindo o mesmo padrão visual da página de Permissões: lista de usuários à esquerda, e à direita duas abas com os agentes vinculados e disponíveis.

### Estrutura de Arquivos

```text
src/pages/admin/monitoramento/
├── MonitoramentoPage.tsx          # Página principal (layout 1/3 + 2/3)
├── components/
│   ├── MonitoramentoUserList.tsx   # Lista de usuários (reutiliza padrão do PermissionsList)
│   └── MonitoramentoEditor.tsx    # Painel direito com 2 abas
└── hooks/
    └── useMonitoramentoData.ts    # Hooks para buscar/editar vínculos
```

### 1. `MonitoramentoPage.tsx`
Layout idêntico ao `PermissoesPage`: grid 1/3 (lista de usuários) + 2/3 (editor). Usa `useUsersWithPermissions` (já existente) para listar usuários com filtro por role e busca.

### 2. `MonitoramentoUserList.tsx`
Componente simplificado baseado no `UserPermissionsList` existente: filtro por role, busca por nome/email, lista clicável.

### 3. `MonitoramentoEditor.tsx`
Painel com duas abas (Tabs):
- **Vinculados**: Lista agentes já atrelados ao usuário selecionado. Cada item mostra nome/escritório, cod_agent, badge "Proprietário"/"Monitorado", e botões para editar (toggle proprietário) e excluir.
- **Disponíveis**: Lista todos os agentes que ainda NÃO estão vinculados ao usuário. Cada item tem botão "Vincular" com switch de Proprietário.

### 4. `useMonitoramentoData.ts`
- `useUserLinkedAgents(userId)` — chama `get_user_agents` (já existe no backend)
- `useAllAgentsForLinking(userId)` — chama uma nova action `get_available_agents_for_user` que retorna agentes não vinculados ao usuário
- `useLinkAgent()` — mutation que chama `insert_user_agent` (já existe)
- `useUnlinkAgent()` — mutation que chama nova action `delete_user_agent`
- `useUpdateAgentLink()` — mutation que chama nova action `update_user_agent_ownership`

### 5. Backend: novas actions no `db-query/index.ts`

**`get_available_agents_for_user`**: Retorna agentes que não possuem vínculo com o userId:
```sql
SELECT a.id, a.cod_agent, c.name AS client_name, c.business_name
FROM agents a
JOIN clients c ON c.id = a.client_id
WHERE a.is_visibilided = true
AND NOT EXISTS (
  SELECT 1 FROM user_agents ua
  WHERE ua.cod_agent = a.cod_agent AND ua.user_id = $1
)
ORDER BY c.business_name
```

**`delete_user_agent`**: Remove vínculo por user_id + cod_agent:
```sql
DELETE FROM user_agents WHERE user_id = $1 AND cod_agent = $2::bigint
```

**`update_user_agent_ownership`**: Atualiza agent_id (toggle proprietário):
```sql
UPDATE user_agents SET agent_id = $3::int
WHERE user_id = $1 AND cod_agent = $2::bigint
```

### 6. Rota e Navegação

Adicionar rota em `App.tsx`:
```tsx
<Route path="/admin/monitoramento" element={
  <ProtectedRoute module="admin_agents"><MonitoramentoPage /></ProtectedRoute>
} />
```

### Resumo de arquivos

| Arquivo | Ação |
|---|---|
| `src/pages/admin/monitoramento/MonitoramentoPage.tsx` | Criar |
| `src/pages/admin/monitoramento/components/MonitoramentoUserList.tsx` | Criar |
| `src/pages/admin/monitoramento/components/MonitoramentoEditor.tsx` | Criar |
| `src/pages/admin/monitoramento/hooks/useMonitoramentoData.ts` | Criar |
| `supabase/functions/db-query/index.ts` | Adicionar 3 actions |
| `src/lib/externalDb.ts` | Adicionar 3 métodos |
| `src/App.tsx` | Adicionar rota |

