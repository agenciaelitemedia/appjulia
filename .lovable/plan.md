## Objetivo

Criar um módulo **Chat (Admin)** na categoria ADMINISTRAÇÃO no menu, mover as configurações de chat para essa nova área e simplificar a página `/configuracoes`.

## Mudanças

### 1. Nova página `src/pages/admin/chat/ChatAdminPage.tsx`
Página com Tabs reaproveitando componentes existentes:
- **Provedores de Fila** — extrai o bloco atual do `ConfiguracoesPage` (lista de `ProviderCard`, botões "Novo Provedor" e "Resetar Chat", `ProviderFormDialog`, `ResetChatDialog`, auto-seed UaZapi).
- **Chat (Configurações por cliente)** — usa `ChatSettingsTab` já existente, **com uma busca** acima da lista filtrando por `client_name` / `client_business_name` / `client_id`.
- **History UaZapi** — usa `UazapiHistoryTab`.
- **Monitor da Fila** — usa `UazapiMonitorTab`.
- **Manutenção de Filas** — usa `QueueMaintenanceTab`.

Header: ícone `MessageSquare`, título "Chat (Admin)".

### 2. Busca na aba "Chat"
Adicionar campo `Input` (ícone Search) em `ChatSettingsTab.tsx` que filtra `settings` no client-side (case-insensitive) por nome do cliente, razão social e ID. Sem resultados → mensagem "Nenhum cliente encontrado".

### 3. `src/pages/configuracoes/ConfiguracoesPage.tsx`
- Remover abas **Provedores de Fila** e **Chat** (e todo o código associado: imports, hooks de providers, dialogs, estados).
- Manter: **IA's**, **History UaZapi**, **Monitor da Fila**, **Manutenção de Filas**.
- `defaultValue` da Tabs passa a ser `ai`.

### 4. Registro do módulo
Novo hook `src/hooks/useEnsureChatAdminModule.ts` (padrão dos demais `useEnsure*`):
- code: `chat_admin`
- name: "Chat (Admin)"
- route: `/admin/chat`
- menu_group: `ADMINISTRATIVO`
- icon: `MessageSquare`
- category: `admin`

Chamar o hook em `src/components/layout/Sidebar.tsx` junto aos demais.

Adicionar `'chat_admin'` em `ModuleCode` (`src/types/permissions.ts`).

### 5. Roteamento
Em `src/App.tsx`:
- `const ChatAdminPage = lazy(() => import("./pages/admin/chat/ChatAdminPage"));`
- `<Route path="/admin/chat" element={<ProtectedRoute module="chat_admin"><ChatAdminPage /></ProtectedRoute>} />`

## Arquivos tocados
- **Novo**: `src/pages/admin/chat/ChatAdminPage.tsx`, `src/hooks/useEnsureChatAdminModule.ts`
- **Editado**: `src/pages/configuracoes/ConfiguracoesPage.tsx`, `src/pages/configuracoes/components/ChatSettingsTab.tsx`, `src/components/layout/Sidebar.tsx`, `src/App.tsx`, `src/types/permissions.ts`

## Observações
- Nenhuma mudança de schema/backend; só UI e registro de módulo (que usa o `externalDb.createModule` padrão).
- Após o primeiro carregamento como admin, o item aparece automaticamente no menu ADMINISTRATIVO.
