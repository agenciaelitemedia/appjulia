# Wavoip — conexão por QR Code e Webphone SDK

## Contexto
- O token cadastrado em `wavoip_devices.device_token` é token do dispositivo/Webphone, não é um Bearer token válido para consultar REST API de status.
- A chamada antiga para endpoint REST de status retornava `401 Auth Token is invalid` ou `404`, por isso o botão de reconectar falhava.

## Fluxo correto
- No `/wavoip`, o botão deve ser **Conectar** e abrir um modal de pareamento.
- O QR Code pode ser exibido por:
  - `https://devices.wavoip.com/{device_token}/whatsapp/qr-image`; ou
  - `qrCode` retornado pelo Webphone SDK em `wavoip.device.get()`.
- O frontend carrega `@wavoip/wavoip-webphone`, executa `device.add(token, true)` e `device.enable(token)`.
- O status real deve ser monitorado pelo SDK; quando `device.get()` indicar `status === 'open'`, o dispositivo está vinculado e o discador pode ser liberado.

## Persistência
- Ao conectar, salvar em `wavoip_devices`:
  - `connection_status = 'connected'`
  - `connected_at`
  - `last_seen_at`
  - `whatsapp_number`, `whatsapp_jid`, `whatsapp_jids` quando disponíveis
  - `metadata.last_connect` com snapshot do SDK
- Durante o pareamento, salvar `connection_status = 'connecting'`.
- Em timeout/erro, salvar `connection_status = 'error'` e `metadata.last_error`.

## Usuário interno
- O projeto usa autenticação própria com `users.id` numérico.
- O campo original `user_id` do módulo Wavoip é UUID/legado de Supabase Auth e não deve receber `users.id`.
- O vínculo com o usuário do app deve usar `wavoip_devices.app_user_id` e `wavoip_call_logs.app_user_id`.

## Edge function
- `wavoip-connect-device` não deve consultar REST API de status da Wavoip.
- Ela só prepara o registro para conexão e retorna a URL do QR Code; a detecção de status conectado é feita no navegador via SDK.