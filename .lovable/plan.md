## Diagnóstico

`BlitzSubdomainGate` faz o redirect dentro de um `useEffect`. No primeiro render em `blitzleads.atendejulia.com.br/`:

1. `<Routes>` casa `path="/"` com `<Dashboard />` dentro de `MainLayout`.
2. Como o usuário está deslogado, `ProtectedRoute`/`AuthProvider` renderiza um `<Navigate to="/login">` **de forma síncrona durante o render**.
3. Só depois o `useEffect` do `BlitzSubdomainGate` roda e tenta ir para `/BlitzLead/` — mas a navegação para `/login` já aconteceu.

Resultado: o subdomínio cai em `/login` (Julia) em vez de `/BlitzLead/blitz_auth`.

Fatores agravantes:
- O gate depende do `useBlitzRouteMap` (query async). Mesmo que a query resolva, o efeito só dispara após o primeiro paint.
- Não há mapeamento explícito de `/login` → `/BlitzLead/blitz_auth`, então mesmo se o gate rodasse depois, o usuário já teria caído no login do Julia.

## Correção

Fazer o redirect ser **síncrono no render** e rodar antes das `<Routes>` do Julia, com fallback puramente client-side (sem depender da query do banco no primeiro paint).

### Passo 1 — `src/blitzleads/lib/subdomain.ts`
- Adicionar `resolveInitialBlitzTarget(pathname)` puro (sem depender da tabela) que trata:
  - `/` → `/BlitzLead/`
  - `/login` → `/BlitzLead/blitz_auth`
  - `/blitz_auth` → `/BlitzLead/blitz_auth`
  - qualquer path que não começa com `/BlitzLead` → `/BlitzLead${pathname}`
- Manter `resolveBlitzTarget` como está (usado pela aba de configuração para overrides customizados).

### Passo 2 — Substituir `BlitzSubdomainGate` por um componente síncrono

Trocar o efeito por render puro:

```tsx
export function BlitzSubdomainGate() {
  const location = useLocation();
  if (!isBlitzHost()) return null;
  const target = resolveInitialBlitzTarget(location.pathname);
  if (target && target !== location.pathname) {
    return <Navigate to={target} replace />;
  }
  return null;
}
```

Assim o `<Navigate>` do gate e o do `ProtectedRoute` competem no **mesmo** ciclo de render — como o gate está montado antes de `<Routes>` no JSX de `App.tsx`, ele resolve primeiro e a URL vira `/BlitzLead/...` antes de qualquer `ProtectedRoute` reagir.

### Passo 3 — Aplicar overrides do banco depois do primeiro render

Manter uma segunda passada (efeito) que consulta `useBlitzRouteMap` e, se o mapeamento salvo apontar para outra rota interna dentro de `/BlitzLead/*`, faz `navigate(target, { replace: true })`. Isso preserva o de-para configurável sem bloquear o boot.

### Passo 4 — Ajuste em `BlitzLayout`

`BlitzLayout` hoje redireciona não-autenticados para `/BlitzLead/blitz_auth` — ok. Confirmar que o `AuthProvider` **não** chama `Navigate to="/login"` global quando a rota já é `/BlitzLead/*` (verificar rapidamente durante a implementação; se chamar, adicionar exceção para paths iniciados por `/BlitzLead`).

## Fora de escopo
- DNS/registros do subdomínio (já apontados pelo usuário).
- Login próprio do BlitzLeads (segue como está).
- Configuração de-para editável na `/configuracoes` (permanece, apenas passa a ser overlay do fallback síncrono).

## Verificação após build
1. `blitzleads.atendejulia.com.br/` → `/BlitzLead/` (dashboard call-center).
2. `blitzleads.atendejulia.com.br/login` → `/BlitzLead/blitz_auth`.
3. `blitzleads.atendejulia.com.br/call-center` → `/BlitzLead/call-center`.
4. Domínio principal `appjulia.lovable.app` sem mudanças de comportamento.