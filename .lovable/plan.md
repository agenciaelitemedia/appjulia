## Objetivo

Remover todas as restrições e tratamentos especiais do perfil **advogado**, fazendo com que ele se comporte exatamente como o perfil **time**: usa o `MainLayout` padrão, é redirecionado para `/dashboard` no login, e tem menus/permissões controlados exclusivamente pelos módulos atribuídos no admin (sem auto-add de `adv_dashboard`, sem bypass de permissão, sem layout próprio).

## Mudanças

### 1. `src/pages/Login.tsx`
- Remover redirecionamento condicional para `/adv/dashboard`.
- Sempre navegar para `/dashboard` após login (linhas 23-26 e 50-53). O `ProtectedRoute` cuidará do redirecionamento se o usuário não tiver acesso ao dashboard.

### 2. `src/contexts/AuthContext.tsx`
- Remover bloco que chama `externalDb.ensureAdvModule()` para advogados (linhas 122-125).
- Remover regra `if (user?.role === 'advogado' && moduleCode === 'adv_dashboard') return true;` em `hasPermission` (linhas 150-151). Permissão passa a vir somente do mapa de permissões padrão.

### 3. `src/App.tsx`
- Remover import e bloco de rota `<Route element={<AdvLayout />}>` com `/adv/dashboard` (linhas 12, 88, 197-198 e fechamento correspondente).
- Remover import `AdvDashboardPage` se não usado em outro lugar.

### 4. `src/pages/equipe/components/EquipeMemberDialog.tsx`
- Remover lógica de auto-adicionar `adv_dashboard` ao selecionar perfil advogado (linhas 377-380).
- Remover mensagem informativa "O módulo Painel do Advogado será adicionado automaticamente" (linhas 392-396).
- Manter a opção `<SelectItem value="advogado">` no select — perfil continua existindo, apenas sem comportamento especial.

### 5. Arquivos a deletar
- `src/components/layout/AdvLayout.tsx`
- `src/pages/adv/AdvDashboardPage.tsx`
- `src/pages/adv/components/AdvContratosCards.tsx` (se usado apenas pela página acima — verificar)

### 6. Manter inalterado
- `AppRole` continua incluindo `'advogado'` (label "Advogado" preservado em selects).
- `useMenuModules` já filtra por permissões — não há mudança necessária; advogados verão exatamente os módulos liberados manualmente pelo admin, igual ao perfil "time".
- Nenhuma migração de banco necessária; usuários existentes com role `advogado` continuam funcionando normalmente.

## Resultado esperado

Após as mudanças, advogados:
- Fazem login e caem em `/dashboard` (ou são redirecionados pelo `ProtectedRoute` conforme suas permissões).
- Veem o `MainLayout` padrão com sidebar e menus baseados nos módulos atribuídos.
- Não têm nenhum acesso garantido automaticamente — comportamento idêntico ao perfil "time".
