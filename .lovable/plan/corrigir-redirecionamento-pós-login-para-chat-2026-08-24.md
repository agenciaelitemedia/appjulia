# Corrigir redirecionamento pós-login para /chat

## O que está acontecendo (verificado no código)

Duas causas independentes fazem o usuário não-owner cair sempre em `/dashboard`:

1. **Rota calculada antes do login existir** — em `src/pages/Login.tsx:99`, `postLoginRoute` é calculado no render com `user` e `permissions` ainda vazios (`user = null`, mapa de permissões `null`). O `navigate(postLoginRoute)` em `handleSubmit` usa esse valor congelado, portanto sempre `/dashboard`.

2. **Não existe módulo `chat`** — `hasPermission('chat', 'view')` nunca retorna `true` para não-admin: em `src/types/permissions.ts` só há `chat_admin`, e a rota `/chat` em `src/App.tsx:207` é aberta a qualquer usuário autenticado (sem `ProtectedRoute` de módulo). Ou seja, a condição de permissão do chat é sempre falsa fora de admin (que é owner e vai para `/dashboard`).

## Correção

Em `src/pages/Login.tsx`:

1. Trocar o cálculo no corpo do componente por um `useEffect` que roda quando `isAuthenticated` é verdadeiro e `permissionsLoading` é falso — assim a decisão usa o usuário e as permissões já carregados pelo `login()`.
2. Nova regra de destino:
   ```text
   SE !isOwnerUser(user) E temAcessoAoChat(user, permissions)
     → /chat
   SENÃO
     → /dashboard
   ```
3. `temAcessoAoChat`: como `/chat` não é um módulo protegido, considerar liberado por padrão para não-owner, **exceto** quando existir uma entrada explícita de módulo de chat com `can_view = false` no mapa de permissões (respeitando bloqueios configurados manualmente).
4. Remover o `navigate(postLoginRoute)` do `handleSubmit` (o efeito passa a cuidar disso) e manter o `<Navigate>` para quem já está autenticado, usando a mesma rota calculada — sem redirecionar enquanto as permissões ainda carregam.

## Detalhes técnicos

- Nenhuma mudança em backend, banco, RLS ou em `AuthContext`.
- Papéis owner continuam vindo de `src/lib/auth/isOwner.ts` (`admin`, `user`, `colaborador`).
- Validação: `tsgo` para checagem de tipos e um login simulado no preview com usuário de papel `time`/`advogado` para confirmar a chegada em `/chat`.
