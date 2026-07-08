# Ajustes no discador Wavoip

Consultei o SDK `@wavoip/wavoip-webphone` (referência atual: v1.6.1) e o fluxo em `src/contexts/WavoipContext.tsx` + `src/pages/wavoip/WavoipPage.tsx`. Dois ajustes são necessários.

## 1. Sempre tema claro

Hoje o `render()` já passa `theme: 'light'`, mas o menu de configurações do widget (`statusBar.showSettingsIcon`) permite que o usuário troque para dark, e o SDK persiste essa preferência em `localStorage`, sobrescrevendo o tema light nas próximas sessões. Precisamos:

- Manter `theme: 'light'` no `render()`.
- Adicionar, logo após o `render()`, uma limpeza determinística que force o tema claro em toda sessão:
  - Remover as chaves de tema salvas pelo SDK (`localStorage.removeItem` para `wavoip:theme`, `wavoip-theme`, `wavoip.webphone.theme` — as três variações usadas por versões diferentes do SDK).
  - Se o SDK expuser `wp.setTheme?.('light')` ou `wp.theme?.set?.('light')`, chamar após o render (fallback silencioso).
  - Injetar um pequeno `<style>` global no `<head>` que fixa `data-theme="light"` no root do widget (`.wavoip-webphone[data-theme] { color-scheme: light; }` + `.wavoip-webphone-dark { display: none !important; }` como salvaguarda visual caso o SDK tente aplicar dark classes).
- Ocultar o toggle de tema do menu de settings do SDK via CSS (seletor `[data-testid="theme-toggle"]`, `.wavoip-theme-switch`) para o usuário não conseguir voltar para dark.

## 2. Lista de dispositivos restrita ao `client_id`

Sintoma: o menu "Dispositivos" do widget e a página `/wavoip` mostram dispositivos que não pertencem ao cliente logado.

Causa identificada:

1. **No SDK**: `settingsMenu.deviceMenu` está com `showAddDevices: true`. Essa opção habilita o botão "Adicionar dispositivo" dentro do widget, que faz o SDK **listar todos os dispositivos da conta Wavoip** (a conta é única, compartilhada por todos os clientes) — daí aparecerem tokens de outros clientes.
2. **Na página `/wavoip`**: o filtro atual em `myDevices` (`WavoipPage.tsx` ~L85) considera também `!d.app_user_id && d.status === 'in_use' && d.client_id === clientId`. Isso faz aparecerem dispositivos do mesmo `client_id` mesmo que ainda não estejam vinculados ao usuário — ok em teoria, mas o `load()` já busca `.eq('client_id', clientId)`, então a lista base é do cliente. O problema real relatado é o widget do SDK listando outros clientes.

Alterações:

- Em `src/contexts/WavoipContext.tsx`, na config passada ao `render()`:
  - `settingsMenu.deviceMenu.showAddDevices = false` (impede o SDK de puxar a listagem completa da conta Wavoip).
  - `settingsMenu.deviceMenu.showRemoveDevicesButton = false` (o gerenciamento fica em `/wavoip`).
  - Manter `showEnableDevicesButton: true` apenas para os tokens que nós adicionamos via `device.add()`.
- Após o `render()`, chamar `wp.device.get()` e, para cada token retornado que **não** esteja em `userDevicesRef.current` (nossos tokens do `client_id` + `app_user_id`), executar `wp.device.remove(token)`. Isso limpa qualquer cache interno do SDK herdado de outro login/aba.
- Em `refreshDevices()`, já removemos tokens ausentes. Reforçar o mesmo saneamento em `ensureWebphone()` logo após montar o widget, para o estado inicial.
- Em `src/pages/wavoip/WavoipPage.tsx`:
  - Ajustar `myDevices` para exibir somente dispositivos do usuário logado: `devices.filter(d => Number(d.app_user_id) === appUserId)`. Dispositivos livres do pool do cliente continuam disponíveis pelo botão "Adicionar dispositivo" (que chama `handleClaim` e faz o vínculo `app_user_id`), mas não poluem a lista visual.
  - O `load()` continua com `.eq('client_id', clientId)` — mantém o escopo por cliente no nível da query.

## Detalhes técnicos

Arquivos alterados:

- `src/contexts/WavoipContext.tsx` — config de `render()`, saneamento pós-render, injeção de CSS de tema.
- `src/pages/wavoip/WavoipPage.tsx` — filtro `myDevices` restrito a `app_user_id === user.id`.

Nenhuma alteração de schema, edge function ou RLS. Nenhuma alteração no `HeaderDialer` (o ícone SIP no header não é afetado).

## Fora de escopo

- Não altero a lógica de `startCall` / gravação / webhook.
- Não altero o admin Wavoip (`/admin/wavoip`), que precisa continuar vendo todos os dispositivos.
- Não mexo no tema global do app — o `theme: 'light'` é aplicado apenas ao widget Wavoip.
