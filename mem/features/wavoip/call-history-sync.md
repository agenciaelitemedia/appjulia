---
name: Wavoip Call History Sync
description: Sincronização 3-camadas do histórico de chamadas Wavoip com gravação no nosso storage
type: feature
---
**Fonte da verdade**: `wavoip_call_logs` com unique index parcial em `whatsapp_call_id`.

**3 camadas complementares**:
1. **Webphone (frontend)** — `WavoipContext` escuta `call:started/answered/ended/rejected`, lê `wp.call.getCallActive()` p/ pegar `id` (= whatsapp_call_id) e faz upsert por `whatsapp_call_id`. Ao encerrar, agenda retries (5s/15s/30s/60s/120s) chamando `wavoip-fetch-recording`.
2. **Webhook (push externo)** — `wavoip-call-webhook` recebe eventos da Wavoip e faz mesmo upsert + trigger.
3. **Poll (rede de segurança)** — `wavoip-sync-history` consulta API Wavoip (`https://api.wavoip.com/calls` com Bearer device_token), upsert no log, dispara fetch da gravação. Cron pg_cron a cada 5 min. Botão "Sincronizar com Wavoip" na aba Histórico chama manualmente.

**Gravação**: `wavoip-fetch-recording` baixa de `storage.wavoip.com/{whatsapp_call_id}` para bucket privado `wavoip-recordings` path `{client_id}/{whatsapp_call_id}.{ext}`. `RecordingPlayer` faz polling leve a cada 20s enquanto status=pending/downloading (até 3min) e gera signed URL ao abrir popover.
