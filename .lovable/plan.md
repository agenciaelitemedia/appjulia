

## Corrigir alerta de filas desconectadas no login

### Problema identificado

O alerta de "Filas desconectadas" não aparece porque há uma **race condition** com o flag `julia_just_logged_in` em `sessionStorage`:

- `DisconnectedAgentsAlert` e `DisconnectedQueuesAlert` rodam em paralelo após o login.
- O check de agentes geralmente termina antes (chama `/instance/status` via `UaZapiClient` direto), enquanto o de filas chama uma Edge Function (`uazapi-instance-manager`), que tem latência maior.
- Quando o effect de `DisconnectedAgentsAlert` roda primeiro, ele **remove** o flag (`sessionStorage.removeItem(LOGIN_FLAG)` na linha 88).
- Quando o effect de `DisconnectedQueuesAlert` finalmente roda, o flag já não existe → o alerta é silenciosamente ignorado.

Também há um problema secundário: a verificação só é gatilhada uma vez por sessão (após o login). Se o usuário ficar logado e a fila cair depois, ele nunca verá o alerta — comportamento esperado, mas vale registrar.

### Correção

**Arquivo: `src/components/layout/DisconnectedQueuesAlert.tsx`**

1. **Não depender mais do flag de login** que é "consumido" por outro componente. Em vez disso, usar uma chave própria em `sessionStorage` (`julia_queues_alert_shown`) que marca se o alerta de filas já foi exibido nesta sessão.
2. Lógica:
   - Se `julia_queues_alert_shown === '1'` → não mostrar (já foi exibido nesta sessão).
   - Quando todas as queries terminam e há filas desconectadas → marcar `julia_queues_alert_shown = '1'` e abrir o dialog.
   - O flag é resetado naturalmente ao fechar o navegador (sessionStorage) ou pode ser resetado em `markJustLoggedIn()` do agentes-alert para garantir reset a cada login.

3. **Atualizar `markJustLoggedIn()`** em `DisconnectedAgentsAlert.tsx` para também limpar `julia_queues_alert_shown`, garantindo que cada novo login dispare ambos os alertas.

4. Garantir que o alerta seja exibido mesmo se o usuário já estava logado e o componente acabou de montar com filas desconectadas — atualmente só dispara após login. Manter esse comportamento (apenas no login) para não ser invasivo, mas com o flag próprio funcionando corretamente.

### Resultado esperado

Após login, ambos os alertas (agentes e filas) serão exibidos independentemente, sem que um cancele o outro. A fila UaZapi desconectada que o usuário tem agora será detectada e mostrada no dialog.

### Arquivos alterados

- `src/components/layout/DisconnectedQueuesAlert.tsx` — usar flag próprio `julia_queues_alert_shown` em vez de depender do `julia_just_logged_in` compartilhado.
- `src/components/layout/DisconnectedAgentsAlert.tsx` — `markJustLoggedIn()` também limpa `julia_queues_alert_shown` para resetar a cada login.

