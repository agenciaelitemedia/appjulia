

# Novo Perfil "Advogado" + Módulo `adv_dashboard` com PWA

## Resumo

Criar o role `advogado`, um novo módulo `adv_dashboard` com layout mobile-first independente do `MainLayout`, e configurar PWA para que o app seja instalável no celular. O login redireciona advogados automaticamente para `/adv/dashboard`.

## Alterações

### 1. Tipos — Adicionar role e módulo

- `src/types/permissions.ts`: adicionar `'advogado'` ao `AppRole` e `'adv_dashboard'` ao `ModuleCode`
- `src/pages/admin/permissoes/types.ts`: adicionar label para `advogado`

### 2. Login — Redirecionamento por role

- `src/pages/Login.tsx`: após login, se `user.role === 'advogado'`, navegar para `/adv/dashboard` em vez de `/dashboard`
- `src/contexts/AuthContext.tsx`: sem alteração (role já vem do banco)

### 3. Layout mobile do advogado

Criar `src/components/layout/AdvLayout.tsx`:
- Layout mobile-first sem sidebar desktop
- Header simples com logo, nome do usuário e botão logout
- Bottom navigation (se necessário no futuro)
- `<Outlet />` para conteúdo
- Mesma proteção de autenticação do `MainLayout`

### 4. Página `AdvDashboard`

Criar `src/pages/adv/AdvDashboardPage.tsx`:
- Mensagem de boas-vindas com nome do usuário
- Layout card-based otimizado para mobile
- Placeholder para futuras funcionalidades

### 5. Rotas

- `src/App.tsx`: adicionar rota com `AdvLayout`:
  ```
  <Route element={<AdvLayout />}>
    <Route path="/adv/dashboard" element={<ProtectedRoute module="adv_dashboard"><AdvDashboardPage /></ProtectedRoute>} />
  </Route>
  ```

### 6. PWA — Manifest e meta tags

Criar `public/manifest.json` com ícones, `display: "standalone"`, cores da marca. Adicionar `<link rel="manifest">` e meta tags de PWA no `index.html`. **Sem service worker** (apenas manifest para instalabilidade). Adicionar guard no `main.tsx` para desregistrar SW em iframe/preview.

### 7. Módulo no banco

Migração SQL para inserir o módulo `adv_dashboard` na tabela de módulos (via `db-query` no banco externo, ou seed manual se necessário — depende de como os módulos são gerenciados).

## Arquivos criados/alterados

| Arquivo | Mudança |
|---|---|
| `src/types/permissions.ts` | Adicionar `'advogado'` e `'adv_dashboard'` |
| `src/pages/admin/permissoes/types.ts` | Label do role `advogado` |
| `src/pages/Login.tsx` | Redirect por role |
| `src/components/layout/AdvLayout.tsx` | **Novo** — layout mobile-first |
| `src/pages/adv/AdvDashboardPage.tsx` | **Novo** — boas-vindas |
| `src/App.tsx` | Rotas `/adv/*` com `AdvLayout` |
| `public/manifest.json` | **Novo** — manifest PWA |
| `index.html` | Meta tags PWA + link manifest |
| `src/main.tsx` | Guard anti-SW em iframe |

