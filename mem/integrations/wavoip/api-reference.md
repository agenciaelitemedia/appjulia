---
name: Wavoip API Reference
description: Referência completa dos endpoints Wavoip V2 e WAV Painel — método, path, body e uso. Consultar sempre que o usuário mencionar "wavoip api".
type: reference
---

Base URL padrão: `https://api.wavoip.com` (configurável por provedor em `wavoip_providers.api_base`).
Auth: Bearer JWT obtido em `/v2/login`, salvo em `wavoip_providers.token`.

## Wavoip V2

### Auth
- **POST `/v2/login`** — body `{ email, password }` → `{ message, data: { token } }`. Login e obtenção do JWT.

### Device (autenticado)
- **GET `/v2/devices/me`** — lista dispositivos do usuário.
- **GET `/v2/devices/:id/calls`** — chamadas do dispositivo.
- **GET `/v2/devices/:id/settings`** — configurações gerais.
- **GET `/v2/devices/:id/sip/settings`** — credenciais SIP.
- **GET `/v2/devices/:id/webhook/settings`** — configuração de webhook.
- **GET `/v2/devices/:id/webhook/history`** — histórico de entregas de webhook.
- **GET `/v2/devices/:token/wakeup`** — acorda dispositivo (header `nexturl` opcional).
- **PUT `/v2/devices/:id_device/name`** — body `{ name }`.
- **POST `/v2/devices/:id_device/waba`** — habilita WABA: body `{ fb_token, id_phone_number, phone }`.

### Sales
- **POST `/v2/sales/buy-device`** — body Free: `{ type: "FREE" }`; body Paid: `{ type: "PAID", deviceProps: [{ name, channels, count }] }`.
- **POST `/v2/sales/calculate-order-price`** — body `{ deviceProps: [{ channels, count }] }`.
- **GET `/v2/sales/subscriptions`** — assinaturas.

### Customer
- **GET `/v2/customer/me`** — dados do cliente.
- **POST `/v2/customer/me`** — cria (body: name, nationalIdentity, phone, email, country, zipCode, address, number, complement, district, city, state).
- **PUT `/v2/customer/me`** — atualiza (mesmo shape).

## WAV - PAINEL

### Auth / User
- **GET `/user/me`** — dados do usuário atual.
- **PUT `/user/me`** — atualiza usuário.
- **POST `/user`** — cria usuário.
- **GET `/user/me/check_upgraded`** — verifica upgrade.

### Calls
- **GET `/calls/:call_token`** — chamada por token.
- **GET `/calls/whatsapp/:call_id`** — chamada WhatsApp por id.

### Customer
- **GET `/customer/me`** — cliente.
- **GET `/customer/me/features`** — features.
- **PUT `/customer/me`** — atualiza cliente.

### Devices
- **GET `/devices/:device_id`** — detalhes.
- **DELETE `/devices/:device_id`** — remove.
- **PUT `/devices/:device_id/settings`** — atualiza configurações.
- **POST `/devices/:device_id/evolution/connect`** — conecta ao Evolution.
- **POST `/devices/:device_id/waba`** — cria WABA.
- **POST `/devices/:device_id/webhook`** — cria webhook.
- **PUT `/devices/:device_id/webhook`** — atualiza webhook.

### Geo
- **GET `/geo/countries`** — países.
- **GET `/geo/sub-divisions/:country_code`** — estados/regiões.

## Integração no projeto

- Tabela `wavoip_providers` guarda `api_base`, `username`, `password`, `token`, `token_updated_at`, `last_login_status`.
- Edge function `wavoip-providers` expõe ações: `list`, `create`, `update`, `delete`, `refresh_token`, `get_token`.
- Ao cadastrar/atualizar credenciais, a edge function chama `POST /v2/login` e persiste `data.token`.
- Outras edge functions devem chamar `wavoip-providers` action `get_token` para obter o JWT atualizado antes de invocar endpoints protegidos.

### Provisionamento automático de dispositivos
- Plano Wavoip (`wavoip_plans`) tem `provider_id` obrigatório — define qual conta Wavoip cria os dispositivos.
- Edge function `wavoip-device-provision`: recebe `{ provider_id, plan_id, client_id, user_plan_id, device_name, channels }`, faz `POST /v2/sales/buy-device` (`{type:"FREE",name}` ou `{type:"PAID",deviceProps:[{name,channels,count:1}]}`, name = `JU_<clientId>_<device_name>`), depois `GET /devices/:id` para pegar `token`/`phone`/`id_server`, e insere em `wavoip_devices` com `provider_id`, `wavoip_device_id`, `wavoip_raw` (jsonb do retorno) e `device_token`.
- Ativação do cliente em `useActivateWavoipForUser` chama a edge function uma vez por dispositivo solicitado (o campo `device_names[]` substitui a antiga seleção de pool). Se qualquer criação falhar, o `wavoip_user_plans` é marcado cancelado com o motivo em `notes`.