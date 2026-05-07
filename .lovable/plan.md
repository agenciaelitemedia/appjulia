## Objetivo
1. Bloquear tradução automática do navegador em todo o sistema.
2. Resolver o erro de cache pós-deploy (usuários com a versão antiga tentando carregar chunks/assets que não existem mais — `ChunkLoadError` / `Failed to fetch dynamically imported module`).

---

## Parte 1 — Desabilitar tradução (já planejado)

### `index.html`
- `<html lang="pt-BR" translate="no">`
- `<meta name="google" content="notranslate" />`
- `<meta http-equiv="Content-Language" content="pt-BR" />`
- `<body class="notranslate" translate="no">` e `<div id="root" class="notranslate" translate="no">`

---

## Parte 2 — Estratégia anti-cache em novo deploy

O Vite já gera assets com hash no nome (`index-AbC123.js`), então o problema NÃO é o navegador servir o JS antigo do disco — é o app que JÁ ESTÁ ABERTO na aba do usuário tentar carregar um chunk lazy (`React.lazy` / `import()`) cujo arquivo foi removido pelo novo deploy. Solução em três camadas:

### 2.1 Detectar erro de chunk e recarregar automaticamente
Criar `src/lib/chunkReload.ts`:
- Listener global em `window` para `error` e `unhandledrejection`.
- Se a mensagem casar com `Loading chunk`, `Failed to fetch dynamically imported module`, `Importing a module script failed` ou `ChunkLoadError`:
  - Usar `sessionStorage` com flag `chunk-reload-attempted` para evitar loop infinito.
  - Chamar `window.location.reload()` (uma vez) para buscar o `index.html` novo, que aponta para os hashes atualizados.
- Importar esse módulo no topo do `src/main.tsx`.

### 2.2 Polling de versão + aviso de “nova versão disponível”
- No build, gerar `public/version.json` com timestamp/commit. Hoje o Vite expõe `import.meta.env` mas não um build id automático — usar `define` no `vite.config.ts`:
  - `define: { __APP_VERSION__: JSON.stringify(Date.now().toString()) }`
- Criar hook `src/hooks/useAppVersionCheck.ts`:
  - A cada 5 minutos (e no `visibilitychange` quando a aba volta ao foco), faz `fetch('/version.json?t=' + Date.now())`.
  - Se a versão remota difere da que veio no bundle, dispara um toast persistente “Nova versão disponível — Atualizar” com botão que chama `window.location.reload()`.
- Endpoint server-side simples: criar `public/version.json` com placeholder e atualizá-lo no build via plugin Vite custom (`writeBundle`) ou simplesmente ler `__APP_VERSION__` injetado.
- Montar o hook em `App.tsx` (uma única vez, dentro do provider raiz).

### 2.3 Cabeçalhos / `index.html` sem cache
- O `index.html` em si NUNCA pode ser cacheado, senão o usuário continua vendo as referências aos chunks antigos.
- Adicionar `<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />` e `<meta http-equiv="Pragma" content="no-cache" />` no `<head>` do `index.html` como camada extra (Lovable/CDN normalmente já trata, mas isso reforça em proxies intermediários).

### 2.4 Limpar Service Worker desatualizado (push notifications)
O projeto usa Web Push (Service Worker registrado). SW antigo pode reter `index.html` em cache:
- Em `src/main.tsx`, no boot, chamar `navigator.serviceWorker.getRegistrations()` e, se o SW reportar `updatefound`, exibir o mesmo toast “Nova versão disponível”.
- Confirmar que o SW de push (`public/sw.js` ou similar) NÃO faz `cache.match` para HTML/JS principal — apenas para receber push events. Se fizer, remover essa parte.

---

## Resultado esperado
- Usuários com a aba aberta durante um deploy: ao navegar para uma rota lazy ou após 5 min, recebem aviso de nova versão. Se um chunk falhar, a página recarrega sozinha 1x.
- Tradução do navegador deixa de aparecer.

## Arquivos afetados
- `index.html`
- `src/main.tsx`
- `src/App.tsx`
- `src/lib/chunkReload.ts` (novo)
- `src/hooks/useAppVersionCheck.ts` (novo)
- `vite.config.ts`
- `public/version.json` (novo)
- Verificação no service worker existente