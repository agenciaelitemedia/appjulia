# Telefonia, Pagamentos/Checkout, Vídeo

## 1. Telefonia — visão geral

**Dois subsistemas independentes** + um passivo:
1. **SIP/PBX** (api4com + 3cplus) — softphone clássico com ramais, `PhoneContext` + `useSipPhone` (JsSIP). Tabelas `phone_*`.
2. **Wavoip** — chamadas via WhatsApp usando o SDK `@wavoip/wavoip-webphone`, módulo `/wavoip` independente (`WavoipContext`). Tabelas `wavoip_*`.
3. **vellip** — só webhook passivo de CDR de campanhas, sem discagem.

`queue-*` (filas WhatsApp/WABA) **não são** telefonia-ramal — é sobre canais de chat.

## 2. Provedores SIP

### api4com — `api4com-proxy/index.ts`
Proxy com `action` switch, `Authorization: <api4com_token>`. Actions: `dial` (resolve `phone_extensions.api4com_ramal`), `create_extension` (cria org user + ramal, auto-numeração desde 1000, rollback completo em falha), `update/delete_extension`, `hangup`, `get_sip_credentials` (`{domain, username=ramal, password, wsUrl:wss://{sip_domain}:6443}`, auto-hidrata credenciais faltantes), `sync_extensions`, `sync_call_history` (paginado, upsert `phone_call_logs` por `call_id`), `setup_webhook`, `get_account`.

Webhook `api4com-webhook`: persiste só em `channel-hangup`/`hangup_cause`; upsert `phone_call_logs`; resolve `cod_agent`/`client_id` pela extensão; enriquece CDR incompleto via `/calls`.

### 3cplus — `threecplus-proxy/index.ts`
Auth via `?api_token=`. Actions incluem `get_sip_credentials` (o mais complexo — cadeia de prioridade: **P0** SIP manual (`sip_manual_*`) bypassa 3C+; **P1** login oficial `/agent/webphone/login` com retry em 403; **P2** credenciais cacheadas; **P3 desabilitado** — nunca cai para SIP genérico, retorna `{blocked, errorCode:'WEBPHONE_PERMISSION_REQUIRED'}` se sem licença webphone), `dial` (`/click2call` com token do próprio agente), `hangup`, `create_extension` (`role:agent`, retry de conflito até 20x), `delete_extension`, `sync_extensions`, `sync_call_history`, `diagnose_token`, `validate_sip`.

Webhook `threecplus-webhook`: persiste em `call-was-ended`, resolve agente via `threecplus_agent_id`/`extension`, upsert `phone_call_logs`.

### vellip — `vellip-webhook/index.ts`
Webhook-only. Insere `vellip_call_logs`. Se `cd_resp1==="1"` auto-cria card em `crm_comercial_cards` (stage "Interessados") + `crm_comercial_history`.

## 3. Softphone (frontend)

**`src/pages/telefonia/hooks/useSipPhone.ts`** — wrapper JsSIP. Status: `idle|registering|registered|calling|ringing|in-call|error`. WSS auto-discovery, ringtone sintetizado (WebAudio), auto-answer gate (só dentro de janela de 60s após dial do usuário, previne resposta automática a chamada de campanha não solicitada).

**`src/contexts/PhoneContext.tsx`** — orquestrador: busca extensão ativa do usuário (`phone_extensions.assigned_member_id`), verifica plano ativo (`phone_user_plans`), resolve provider (`phone_config`), auto-conecta SIP com backoff exponencial (máx 8 tentativas, ~5min cap). `dialNumber()` → formata → garante registro SIP → invoca proxy do provider (`getPhoneProxy()` de `src/lib/phoneProxy.ts`) → enfileira `call_id` para sync. Erros não-retryable do 3C+ (falta de licença webphone) viram toast orientando preenchimento manual.

**`SoftphoneWidget.tsx`** — widget fixo (canto ou overlay central), estados dialing/error/calling/ringing/in-call, teclado DTMF, grace timeout de 15s após encerrar.

**Wavoip (softphone alternativo)** — `WavoipContext.tsx`: importa dinamicamente `@wavoip/wavoip-webphone`, widget embutido (tema claro forçado). Dispositivos (`wavoip_devices`, compartilháveis via `wavoip_device_members`). `startCall(phoneE164)` normaliza BR E.164, escolhe device conectado, `wp.call.start()`. Eventos SDK atualizam `wavoip_call_logs` + disparam `wavoip-fetch-call-details`. Loop de reconciliação 10s sincroniza status SDK→DB.

## 4. Provisionamento

### SIP — `telephony-provision`
Disparado fire-and-forget pelo `mercadopago-webhook` após pagamento aprovado. Idempotente. Passos: valida `client_id`, escolhe provider default (`telephony_providers.is_default`), insere/reusa `phone_config` (unique por client+provider), desativa planos anteriores + insere novo `phone_user_plans`, marca order `provisioned`. Ramais em si são criados sob demanda via `create_extension`.

### Wavoip — `wavoip-device-provision` (admin)
Login no provider (`/v2/login`, JWT cacheado), **sempre compra device FREE** (`/v2/sales/buy-device`), insere `wavoip_devices` (`status:'in_use'`, `connection_status:'disconnected'`), renomeia device. `wavoip-connect-device` prepara QR pairing. `wavoip-configure-webhook`/`verify-webhook` — lifecycle de webhook.

### Filas (WhatsApp, não telefonia) — `queue-provision`
Insere `queue_user_plans` (cumulativo) + RPC `apply_queue_limit_from_order` (idempotente) para `chat_client_settings.settings.QUEUE_LIMIT`.

## 5. Orders/Plans (telefonia + filas + vídeo)

Padrão comum: **create** (valida + insere `draft`, pricing 100% server-side em centavos) → **checkout** (Mercado Pago Checkout Pro — **só MP** para estas 3 famílias). Cliente pode mandar `client_breakdown_cents`; servidor tolera 1 centavo, loga divergência em `metadata`.

- **Telefonia**: `telephony-order-create` (`phone_extension_plans`, add-ons recording/transcription 9990/mês, grátis semestral/anual) → `telephony-order-checkout` (`order_nsu` prefixo `TEL-MP-`) → `telephony-notify-paid` (WhatsApp de confirmação via UaZapi).
- **Filas**: `queue-order-create`/`checkout` (`queue_plans`, `FIL-MP-`).
- **Vídeo**: `video-order-create`/`checkout` (`video_plans`, add-ons grátis semestral/anual, `VID-MP-`).

## 6. Pagamentos — 3 gateways

Todos seguem: `POST {order_id}` → busca order → config em `julia_payment_config` → chama API do provedor → grava `checkout_url`+`status='pending'`. Webhook flipa para `paid`.

### Asaas — `asaas-checkout`/`webhook`
Auto-detecta sandbox vs produção pelo prefixo da API key. Busca/cria customer por CPF/CNPJ, cria pagamento `CREDIT_CARD` com **12 parcelas fixas**. Webhook processa só `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED`, usa `externalReference=order_id`, só atualiza `julia_orders` (**sem provisionamento automático**).

### Mercado Pago — `mercadopago-checkout`/`webhook`
Cria preferência Checkout Pro. **`mercadopago-webhook` é o hub central multi-produto**: resolve tabela de order por `external_reference` tentando `julia_orders → queue_orders → video_orders → telephony_orders`. Em `approved`: seta `paid` + fire-and-forget dispatcha provisionamento (telephony→`telephony-provision`+`telephony-notify-paid`; queue→`queue-provision`; video→`video-provision`).

### InfinityPay — `infinitypay-checkout`/`webhook`
Merchant handle hard-coded. **Sem `external_reference` confiável** — matching por 3 heurísticas: slug do link, `order_nsu`, ou fallback por `plan_price===amount` + mais recente pending (risco de colisão se dois orders tiverem o mesmo preço). Só atualiza `julia_orders`.

**Nota de risco**: Asaas/InfinityPay não disparam provisionamento automático (só `julia_orders`, produto SaaS genérico) — só o fluxo Mercado Pago aciona `*-provision` para telefonia/filas/vídeo.

## 7. Tabelas (payments/orders)

`julia_orders` (SaaS genérico), `julia_payment_config` (config por gateway), `julia_plans`. `queue_orders`+`queue_plans`+`queue_providers`. `video_orders`+`video_plans`+`video_user_plans`. `telephony_orders`+`phone_extension_plans`. Campos comuns entre as 3 famílias de produto: `client_id, customer_*, plan_id/name, billing_period, plan_price, setup_fee, total_amount, status, payment_gateway, order_nsu, checkout_url, mp_preference_id, provisioned_at, provisioning_error, user_plan_id, metadata`.

## 8. Vídeo — Daily.co

Dois conceitos separados:
- **Compra/assinatura**: `video_orders`→`video_user_plans` (minutos, salas concorrentes, add-ons recording/transcription) — parte do sistema de pagamentos (seção 5/6).
- **Chamada em si**: `video-room/index.ts` (backend Daily.co, `DAILY_API_URL`), tabela `video_call_records`. Actions: `create` (cria sala Daily, 1h expiry, gravação em nuvem, máx 4 participantes), `list`/`lead-waiting`/`queue-status` (fila de espera por `cod_agent`), `operator-join`, `join`, `record-start`/`end`, `close` (finaliza + deleta sala), `history`, `get-recording-link`.
- **Lead-facing**: `JoinCallPage.tsx` (`:roomName`) — estados loading/waiting/ready/error/ended.
- **Operador**: `VideoQueuePage.tsx` — `useVideoRooms`, `useRealtimeQueue`, `useCallHistory`, `useRecordingLink`.

## 9. Histórico / Gravações / Transcrição (telefonia)

- **SIP**: `phone_call_logs` (`call_id` unique, direction, caller/called, duração, `record_url`, `hangup_cause`). UI: `HistoricoTab.tsx`, `GravacaoPlayer.tsx`.
- **Wavoip**: `wavoip_call_logs` (`whatsapp_call_id` unique). Pipeline: `wavoip-call-webhook` (eventos DEVICE/RECORD/CALL) → `wavoip-reconcile-runner` (cron 1min) → `wavoip-reconcile-call` (consulta oficial, dispara download) → `wavoip-fetch-recording` (baixa, sobe pro bucket privado `wavoip-recordings`, URL assinada 5 anos, dispara transcrição). Transcrição (`wavoip-transcribe-recording`) gated por `features.transcription`/`recording_summary` do plano — STT via Lovable AI Gateway (`openai/gpt-4o-mini-transcribe`), resumo opcional via `gemini-2.5-flash`.
