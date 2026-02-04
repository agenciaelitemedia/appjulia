
# Plano: Resolver Bloqueio de Links Externos no Iframe

## Problema Identificado

O erro `ERR_BLOCKED_BY_RESPONSE` ocorre porque:
1. O aplicativo roda dentro de um **iframe de preview** do Lovable
2. Links externos com `target="_blank"` tentam abrir dentro do contexto do iframe
3. Sites como Instagram/Facebook bloqueiam isso com headers `X-Frame-Options: DENY`

---

## Solução: Usar `window.top` para Navegar Fora do Iframe

A solução mais simples e eficaz é modificar a página de redirecionamento para usar `window.top.location` ao invés de `window.location`. Isso faz a navegação acontecer no contexto da janela principal, escapando do iframe.

---

## Modificacoes Necessarias

### 1. Atualizar `RedirectPage.tsx`

```typescript
// Antes
window.location.href = decodedUrl;

// Depois - Escapa do iframe
const targetWindow = window.top || window;
targetWindow.location.href = decodedUrl;
```

### 2. Atualizar `externalLink.ts` - Funcao `openExternalLink`

```typescript
export function openExternalLink(url: string): void {
  if (!url) return;
  
  // Tenta usar window.top para escapar do iframe
  const targetWindow = window.top || window;
  
  // Abre em nova aba usando window.open do contexto principal
  try {
    targetWindow.open(url, '_blank', 'noopener,noreferrer');
  } catch {
    // Fallback se cross-origin bloquear
    window.open(getExternalLink(url), '_blank', 'noopener,noreferrer');
  }
}
```

### 3. Adicionar Deteccao de Iframe

Adicionar logica para detectar se estamos em um iframe e aplicar a estrategia correta:

```typescript
function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true; // Cross-origin iframe
  }
}
```

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/RedirectPage.tsx` | Usar `window.top.location.href` para navegar |
| `src/lib/externalLink.ts` | Atualizar `openExternalLink()` para usar `window.top` |

---

## Comportamento Esperado

### Quando em Iframe (Preview Lovable)
1. Usuario clica no link "Acessar"
2. Link direciona para `/redirect?url=...`
3. RedirectPage usa `window.top.location.href = url`
4. Navegacao acontece na janela principal, nao no iframe
5. Site externo carrega normalmente

### Quando em Janela Normal (App Publicado)
1. `window.top === window.self`
2. Comportamento identico, funciona normalmente

---

## Codigo Detalhado

### RedirectPage.tsx (atualizado)

```tsx
useEffect(() => {
  // ... validacoes ...

  const interval = setInterval(() => {
    setCountdown((prev) => {
      if (prev <= 1) {
        clearInterval(interval);
        // Escapa do iframe se necessario
        try {
          const targetWindow = window.top || window;
          targetWindow.location.href = decodedUrl;
        } catch {
          // Fallback para cross-origin
          window.location.href = decodedUrl;
        }
        return 0;
      }
      return prev - 1;
    });
  }, 1000);

  return () => clearInterval(interval);
}, [decodedUrl]);

const handleManualRedirect = () => {
  if (decodedUrl) {
    try {
      const targetWindow = window.top || window;
      targetWindow.location.href = decodedUrl;
    } catch {
      window.location.href = decodedUrl;
    }
  }
};
```

### externalLink.ts (atualizado)

```typescript
export function getExternalLink(url: string): string {
  if (!url) return '#';
  return `/redirect?url=${encodeURIComponent(url)}`;
}

export function openExternalLink(url: string): void {
  if (!url) return;
  
  try {
    // Tenta abrir diretamente via window.top
    const targetWindow = window.top || window;
    targetWindow.open(url, '_blank', 'noopener,noreferrer');
  } catch {
    // Fallback: usa pagina de redirect
    window.open(getExternalLink(url), '_blank', 'noopener,noreferrer');
  }
}

export function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}
```

---

## Resultado Esperado

1. Links externos funcionarao corretamente tanto no preview quanto no app publicado
2. A navegacao escapara do iframe quando necessario
3. Fallback automatico caso `window.top` nao seja acessivel (cross-origin)
4. Sem mudancas na experiencia do usuario - apenas o bloqueio sera resolvido
