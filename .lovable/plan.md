## Problema

O botão "Desconectar" em `/wavoip` (`WavoipPage.handleDisconnect`) hoje só:
1. Chama `wavoip.device.disable/remove` no SDK do webphone (local, no navegador).
2. Marca `connection_status = 'disconnected'` no banco.

Ele **não** encerra a sessão do WhatsApp no lado da Wavoip. Resultado: ao abrir o webphone/QR de novo, o dispositivo volta a aparecer conectado, porque a sessão do WhatsApp continua ativa nos servidores da Wavoip vinculada àquele `device_token`.

## Correção

Criar uma edge function `wavoip-disconnect-device` que faz o logout real do WhatsApp no dispositivo Wavoip, e chamá-la no `handleDisconnect` antes de atualizar o banco.

### Edge function `wavoip-disconnect-device`
- Recebe `{ device_id }`.
- Busca o `wavoip_devices` (service role) para pegar `device_token` e `provider_id`.
- Obtém o JWT do provedor via `wavoip-providers` action `get_token` (padrão já usado em `wavoip-fetch-call-details`).
- Faz logout do WhatsApp no dispositivo via endpoint devices Wavoip usando o `device_token`:
  - `DELETE https://devices.wavoip.com/{device_token}/whatsapp` (endpoint público do device, mesmo host do QR image `https://devices.wavoip.com/{token}/whatsapp/qr-image`).
  - Se retornar 404/405, tentar fallback `GET https://devices.wavoip.com/{device_token}/whatsapp/logout`.
- Também chamar `PUT {api_base}/v2/devices/:id/settings` limpando sessão caso a Wavoip mantenha estado adicional (opcional/best-effort; ignora erro).
- Atualiza `wavoip_devices`: `connection_status='disconnected'`, `connected_at=null`, `whatsapp_jid/jids/number=null`, `metadata.last_disconnect = { source:'wavoip-disconnect-device', at, http_status }`.
- Retorna `{ ok, http_status, endpoint_used }`.
- Todos os erros de rede são capturados e retornam `{ ok:false, error }` sem quebrar o fluxo do frontend.

### Frontend `src/pages/wavoip/WavoipPage.tsx` (`handleDisconnect`)
Novo fluxo:
1. `wp.device.disable(token)` e `wp.device.remove(token)` (mantém — encerra a conexão do webphone local).
2. `await supabase.functions.invoke('wavoip-disconnect-device', { body: { device_id: device.id } })`.
3. Se `ok=false`, mostrar `toast.error` com a mensagem, mas ainda assim atualizar o registro local para `disconnected` (a UI reflete a intenção do usuário).
4. Manter o `load()` + `refreshDevices()`.

Sem alteração no `WavoipContext`, no fluxo de chamadas, no `/wavoip` (só o handler), nem em DB/tipos — a função só faz update em colunas já existentes.

### Observação sobre o endpoint
A API de "sessão WhatsApp" da Wavoip não está listada em `mem://integrations/wavoip/api-reference`. A base `https://devices.wavoip.com/{device_token}/whatsapp/...` é a mesma já usada para o QR (`/qr-image`). A função tentará o `DELETE .../whatsapp` primeiro e cairá para `.../whatsapp/logout` como fallback, gravando no `metadata` qual endpoint funcionou para termos rastreio. Se ambos falharem, o erro fica no toast e no `metadata.last_disconnect.error` para ajustarmos o path exato depois de ver a resposta real.
