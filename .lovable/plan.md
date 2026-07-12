## Objetivo
No login, checar se há nova versão publicada do sistema e, se houver, forçar a atualização no navegador (limpando cache/SW) antes do usuário entrar no app — de forma visível.

## Situação atual
`src/contexts/AuthContext.tsx` já tem `checkVersionAndReloadIfNeeded()` chamado ao final do `login()`, mas:
- Roda depois de carregar permissões/telemetria (demora e o usuário vê o dashboard "piscando" antes do reload).
- Silencioso — sem feedback visual.
- É pulado em `isPreviewHost()` (localhost/preview), o que é ok, mas precisa ficar claro.
- Só compara com `__APP_VERSION__` embutido no bundle; sem query‑string anti‑cache no reload final.

## Mudanças

### 1. `src/contexts/AuthContext.tsx`
- Mover a chamada `await checkVersionAndReloadIfNeeded()` para **logo após a autenticação bem‑sucedida** (antes de `loadPermissions`, `logUserActivity`, telemetria). Assim, se houver nova versão, recarrega imediatamente sem montar o app na versão antiga.
- Em `forceReloadForNewVersion()`:
  - Limpar `localStorage` de chaves de cache do app (mantendo `STORAGE_KEYS.AUTH_USER` para não deslogar) e `sessionStorage`.
  - Trocar `window.location.replace(pathname…)` por `window.location.replace(pathname + '?v=' + Date.now())` para bypass de cache HTTP/proxy, seguido de remover o param no próximo carregamento (ou apenas ir para `/dashboard`).
- Manter o skip em `isPreviewHost()`.

### 2. `src/pages/Login.tsx`
- Ao montar a página, disparar `checkVersionAndReloadIfNeeded()` uma vez (não bloqueia UI; se detectar nova versão, faz reload imediato).
- Enquanto o `login()` estiver em andamento e a checagem detectar update, exibir toast "Atualizando o sistema…" imediatamente antes do reload (via callback opcional passado para a função).

### 3. Exportar a função
- Exportar `checkVersionAndReloadIfNeeded` de `AuthContext.tsx` (ou movê‑la para `src/lib/appVersion.ts`) para reuso pelo `Login.tsx`.

## Fora de escopo
- Polling periódico enquanto logado (já existe fluxo separado / não solicitado).
- Mudar `vite.config.ts`/geração de `version.json` (já funciona).
- Preview/localhost continua sem forçar reload.

## Detalhes técnicos
- `version.json` é escrito no build (`vite.config.ts` → `versionFilePlugin`) com `APP_VERSION = Date.now()` e `__APP_VERSION__` é injetado via `define`. A comparação atual está correta; basta antecipar a chamada e dar feedback visual.
- Ordem final no `login()` bem‑sucedido:
  1. Autentica no backend.
  2. `await checkVersionAndReloadIfNeeded()` → se true, retorna (página vai recarregar).
  3. `setUser`, permissões, telemetria, etc.
