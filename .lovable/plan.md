

# Correção: Advogado redirecionado para /dashboard em vez de /adv/dashboard

## Causa raiz

No `Login.tsx` linha 22-23, existe um guard:
```tsx
if (isAuthenticated) {
  return <Navigate to="/dashboard" replace />;
}
```

Quando `login()` sucede, ele chama `setUser(authenticatedUser)` no AuthContext, o que faz `isAuthenticated` virar `true` **imediatamente**. O componente re-renderiza e o `<Navigate to="/dashboard">` executa ANTES do `navigate(role === 'advogado' ? '/adv/dashboard' : '/dashboard')` na linha 50.

O `navigate()` na linha 50 nunca chega a executar porque o componente já desmontou.

## Correção

Alterar o guard `isAuthenticated` no `Login.tsx` para considerar o role do usuário:

```tsx
if (isAuthenticated) {
  const target = user?.role === 'advogado' ? '/adv/dashboard' : '/dashboard';
  return <Navigate to={target} replace />;
}
```

Isso resolve tanto o redirect pós-login quanto o caso de um advogado já autenticado acessando `/login` diretamente.

## Arquivo alterado

| Arquivo | Mudança |
|---|---|
| `src/pages/Login.tsx` | Guard `isAuthenticated` redireciona baseado em `user.role` |

