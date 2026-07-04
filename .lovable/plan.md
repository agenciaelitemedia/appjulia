## Objetivo

Ajustar o webphone Wavoip para (1) usar tema claro por padrão, (2) exibir como `displayName` da chamada o **`device_name` que o usuário gravou na aba "Meus dispositivos" em `/wavoip`** ao habilitar o dispositivo, e (3) capturar corretamente o `whatsapp_call_id` no início da chamada, gravar no histórico e, ao encerrar, buscar os dados completos da chamada na API Wavoip para consolidar em `wavoip_call_logs` — sem quebrar as funcionalidades atuais (QR/conexão, provisionamento, webhook oficial, gravação).

## Descobertas da documentação (webphone SDK)

- `webphone.render({...})` aceita `theme: "light" | "dark" | "system"` e `callSettings.displayName` (fallback global).
- `api.call.start(to, { displayName, fromTokens })` retorna `{ call: { id, peer }, err }`. `call.id` é o `whatsapp_call_id`. `displayName` aqui **sobrescreve** o global — é aqui que injetaremos o `device_name`.
- Eventos reais expostos por `api.on`: `call:started` (payload com `id` e `peer`), `call:accepted`, `call:ended` (`{ id, status }` com status terminal `ENDED | FAILED | REJECTED | NOT_ANSWERED`), `offer:received`.
- **Não existem** os eventos `call:answered` nem `call:rejected` que o código atual escuta — por isso nunca disparam.

## Origem do `displayName`

- Tabela `wavoip_devices`, coluna `device_name` — preenchida em `/wavoip` no fluxo `handleClaim` (`WavoipPage.tsx`) quando o usuário clica em "Adicionar dispositivo" e informa o nome.
- Um usuário (`app_user_id`) pode ter mais de um dispositivo conectado. Regra:
  - Se `startCall` receber um token específico → usa o `device_name` daquele dispositivo.
  - Senão, escolhe o primeiro dispositivo do usuário com `connection_status='connected'` (ordem por `created_at`) e usa o `device_name` dele.
  - Fallback final: `"Atendimento"` (só se o dispositivo não tiver nome salvo).

## Mudanças

### 1) `src/contexts/WavoipContext.tsx`

- No `webphone.render(...)`: `theme: 'light'` (era `system`). Manter `callSettings.displayName: 'Atendimento'` apenas como fallback global.
- Ampliar o state do contexto com `userDevices: Array<{ id, token, name, connection_status }>`, populado dentro de `loadPlanAndDevices` a partir do mesmo SELECT em `wavoip_devices` (adicionando `id, device_name` às colunas).
- Refatorar `startCall(phone, displayName?)`:
  - Escolher `device` conforme a regra acima.
  - Chamar `wp.call.start(digits, { displayName: displayName ?? device.name ?? 'Atendimento', fromTokens: [device.token] })`.
  - Ao receber `{ call, err }`, se `call.id` existir, upsert imediato em `wavoip_call_logs` com `whatsapp_call_id = call.id`, `status='started'`, `direction='outbound'`, `to_number=digits`, `client_id`, `app_user_id`, `device_id=device.id`, `started_at=now`.
- Reescrever os listeners de `on`:
  - Trocar `['call:started','call:answered','call:accepted','call:ended','call:rejected']` por `['call:started','call:accepted','call:ended','offer:received']`.
  - `call:started`: upsert `status='started'`; guarda `id` no cache por `device_token`.
  - `call:accepted`: upsert `status='answered'`, `answered_at=now`.
  - `call:ended`: mapear `status` (`ENDED→ended`, `FAILED→failed`, `REJECTED→rejected`, `NOT_ANSWERED→not_answered`), `ended_at=now`, `recording_status='pending'`; disparar o retry existente de gravação **e** invocar a nova edge function `wavoip-fetch-call-details` (ver item 3).
  - `offer:received`: upsert com `direction='inbound'`, `status='ringing'`, `from_number` de `offer.peer`.
- Manter o restante do fluxo (conexão QR, `refreshDevices`, `prefillDialer`, webhook oficial) intacto.

### 2) `wavoip_call_logs` (sem mudança de esquema)

- Reutilizar colunas existentes; upserts continuam idempotentes por `onConflict: 'whatsapp_call_id'` (compatível com o webhook oficial que é a fonte da verdade).

### 3) Nova edge function `wavoip-fetch-call-details`

- Body: `{ whatsapp_call_id: string, device_token?: string }`.
- Resolve o dispositivo pela linha atual em `wavoip_call_logs` (ou pelo `device_token`) para obter `provider_id` e o Bearer JWT via `wavoip-providers` action `get_token`.
- `GET {api_base}/calls/whatsapp/{whatsapp_call_id}` com o JWT.
- Upsert em `wavoip_call_logs` mesclando: `status`, `direction`, `from_number`, `to_number`, `whatsapp_jid`, `started_at`, `answered_at`, `ended_at`, `duration_seconds`, `end_reason`, `metadata.details=payload`. Não sobrescreve `recording_status`/`recording_url`.
- CORS padrão, sem alteração em `config.toml`.

### 4) Ajustes de UI

- Nenhuma mudança visual além do tema. `WavoipCallButton` e `HeaderDialer` seguem chamando `startCall` sem `displayName` — o contexto injeta o `device_name` automaticamente.

## Segurança para não quebrar o que já funciona

- Webhook oficial `wavoip-call-webhook` continua sendo a fonte da verdade.
- `wavoip-fetch-recording`, `wavoip-device-provision`, `wavoip-connect-device`, `wavoip-configure-webhook` não são tocadas.
- Fallbacks DOM/iframe de `prefillDialer` preservados.

## Arquivos a editar / criar

- editar `src/contexts/WavoipContext.tsx`
- criar `supabase/functions/wavoip-fetch-call-details/index.ts`
- atualizar `mem/integrations/wavoip/api-reference.md` (eventos reais do SDK + nova função + regra do displayName = device_name).

## Validação

1. `/wavoip` abre em tema claro.
2. Discar → `wavoip_call_logs` recebe linha imediata com `whatsapp_call_id` no `status='started'`.
3. Destinatário vê como caller o `device_name` cadastrado em `/wavoip` (não mais "Atendimento").
4. Ao encerrar → `status`, `ended_at`, `duration_seconds` e `metadata.details` consolidados via `/calls/whatsapp/:id`.
