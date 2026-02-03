
# Plano: Corrigir Detecção de Ambiente para DebugBar

## Problema Identificado

A verificação de ambiente (`isDevEnvironment`) está incorreta:

```typescript
// Codigo atual - NAO FUNCIONA
export const isDevEnvironment = 
  typeof window !== 'undefined' && 
  (window.location.hostname.includes('lovable.app') || window.location.hostname === 'localhost');
```

**Motivo do problema:** O preview do Lovable usa o dominio `lovableproject.com`, nao `lovable.app`:
- URL nos logs: `1f00a8d6-377c-43ef-98e1-d21707c37bc8.lovableproject.com`
- A verificacao procura por `lovable.app`, mas deveria procurar por `lovableproject.com`

## Solucao

Atualizar a verificacao de ambiente para incluir `lovableproject.com`:

```typescript
// Codigo corrigido
export const isDevEnvironment = 
  typeof window !== 'undefined' && 
  (
    window.location.hostname.includes('lovable.app') || 
    window.location.hostname.includes('lovableproject.com') ||  // ADICIONAR ESTA LINHA
    window.location.hostname === 'localhost'
  );
```

---

## Arquivo a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/contexts/DebugContext.tsx` | Adicionar `lovableproject.com` na verificacao de ambiente (linha 4-6) |

---

## Codigo Atual vs Corrigido

### Antes (linha 4-6):
```typescript
export const isDevEnvironment = 
  typeof window !== 'undefined' && 
  (window.location.hostname.includes('lovable.app') || window.location.hostname === 'localhost');
```

### Depois:
```typescript
export const isDevEnvironment = 
  typeof window !== 'undefined' && 
  (
    window.location.hostname.includes('lovable.app') || 
    window.location.hostname.includes('lovableproject.com') || 
    window.location.hostname === 'localhost'
  );
```

---

## Resultado Esperado

1. O `DebugBarToggle` aparecera no sidebar quando acessado via `*.lovableproject.com`
2. A `DebugBar` sera exibida na parte inferior da tela quando ativada
3. Continuara funcionando em `localhost` e `*.lovable.app`
4. NAO aparecera em dominios customizados de producao
