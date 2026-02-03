
# Plano: DebugBar Visível para Admin e Colaborador em Qualquer Ambiente

## Objetivo

Permitir que usuários com role `admin` ou `colaborador` vejam e utilizem a DebugBar em **qualquer ambiente** (produção ou desenvolvimento), enquanto outros usuários só terão acesso em ambientes de desenvolvimento.

## Lógica Atual vs Nova

### Atual
```typescript
// Visibilidade baseada APENAS no domínio
if (!isDevEnvironment) {
  return null;
}
```

### Nova
```typescript
// Visibilidade baseada no domínio OU no role do usuário
const canShowDebugTools = isDevEnvironment || user?.role === 'admin' || user?.role === 'colaborador';

if (!canShowDebugTools) {
  return null;
}
```

---

## Arquivos a Modificar

### 1. `src/components/debug/DebugBarToggle.tsx`

**Mudanças:**
- Importar `useAuth` do contexto de autenticação
- Adicionar lógica que verifica o role do usuário
- Mostrar o toggle se: `isDevEnvironment` **OU** `user.role === 'admin'` **OU** `user.role === 'colaborador'`

```typescript
import { useAuth } from '@/contexts/AuthContext';

export function DebugBarToggle({ isCollapsed = false }: DebugBarToggleProps) {
  const { enabled, setEnabled } = useDebug();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  // Mostrar para: ambiente dev OU admin OU colaborador
  const isPrivilegedUser = user?.role === 'admin' || user?.role === 'colaborador';
  const canShowDebugTools = isDevEnvironment || isPrivilegedUser;

  if (!canShowDebugTools) {
    return null;
  }
  // ... resto do componente
}
```

### 2. `src/contexts/DebugContext.tsx`

**Mudanças:**
- O `DebugProvider` não tem acesso ao `AuthContext` diretamente (pode causar dependência circular)
- Exportar uma função auxiliar `canUseDebugTools(userRole)` para verificação
- Ajustar a inicialização do estado `enabled` para considerar também usuários privilegiados

```typescript
// Função auxiliar para verificar se pode usar debug tools
export function canUseDebugTools(userRole?: string): boolean {
  const isPrivilegedUser = userRole === 'admin' || userRole === 'colaborador';
  return isDevEnvironment || isPrivilegedUser;
}
```

**Nota:** O `DebugProvider` é inicializado antes do `AuthProvider`, então a verificação de role será feita no componente `DebugBarToggle` que já tem acesso ao usuário autenticado.

---

## Fluxo de Visibilidade

| Ambiente | Role | DebugBar Visível? |
|----------|------|-------------------|
| Desenvolvimento (localhost, lovable.app) | Qualquer | Sim |
| Produção (domínio customizado) | admin | Sim |
| Produção (domínio customizado) | colaborador | Sim |
| Produção (domínio customizado) | user | Não |
| Produção (domínio customizado) | time | Não |

---

## Detalhes Técnicos

### Ordem dos Providers no App.tsx
```
QueryClientProvider
  └── TooltipProvider
       └── DebugProvider        ← Inicializado antes do Auth
            └── BrowserRouter
                 └── AuthProvider   ← Usuário disponível aqui
                      └── UaZapiProvider
                           └── Routes
                           └── DebugBar
```

A verificação de role será feita no `DebugBarToggle` e `DebugBar`, que são renderizados dentro do `AuthProvider` e têm acesso ao contexto de autenticação.

---

## Resumo das Mudanças

| Arquivo | Mudança |
|---------|---------|
| `src/components/debug/DebugBarToggle.tsx` | Adicionar verificação de role (`admin`/`colaborador`) para exibir o toggle |
| `src/contexts/DebugContext.tsx` | Exportar função auxiliar `canUseDebugTools` |
| `src/components/debug/DebugBar.tsx` | Adicionar mesma verificação de role para exibir a barra |
