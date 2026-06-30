## Objetivo
Eliminar duplicação no histórico e garantir que TODO registro tenha `WHATSAPP_CALL_ID`, número e gravação. Para isso, a fonte da verdade passa a ser o **Webhook oficial da Wavoip**, configurado automaticamente em cada dispositivo de "Meus Dispositivos".

## Diagnóstico
- Hoje o `WavoipContext` insere uma linha em `call:started` mesmo SEM `whatsapp_call_id` (esses são exatamente os registros "started" com número "-" e duração 00:00 que você vê).
- O `call:ended` cria OUTRA linha (sem id também, porque o SDK não devolve o id da chamada de saída de forma confiável).
- Resultado: 2 linhas órfãs por chamada, sem como casar com a gravação.
- A Wavoip publica via webhook `CALL` (CREATE/UPDATE) com `whatsapp_call_id`, `caller`, `receiver`, `direction`, `duration`, `status` e via `RECORD` com `record_url` quando a gravação fica pronta. Esse é o caminho correto e oficial.

## Plano

### 1. Frontend (`src/contexts/WavoipContext.tsx`) — parar de criar lixo
- Remover o `INSERT` em `upsertCallLog` quando não há `whatsapp_call_id`.
- Manter só o `UPSERT por whatsapp_call_id` quando o SDK eventualmente expõe o id; caso contrário, **não grava nada** — o webhook fará isso.
- Manter `scheduleRecordingFetch` apenas como backup quando já houver id.

### 2. Auto-provisionamento do Webhook por dispositivo
- Nova edge function `wavoip-configure-webhook` que, dado um `device_token`, chama a API da Wavoip para:
  - definir endpoint = `https://<supabase>/functions/v1/wavoip-call-webhook?device_token={token}` (token na query, já que a Wavoip não injeta auth).
  - habilitar eventos `CALL`, `RECORD` e `DEVICE`.
- Disparar essa configuração:
  - Ao conectar um novo dispositivo em `/wavoip` (no fluxo de `wp.device.add/enable`).
  - Botão "Reaplicar webhook" na linha do dispositivo em "Meus dispositivos" (idempotente).
  - Loop one-shot no `wavoip-sync-history` para garantir que todos os dispositivos `connected` tenham webhook ativo.

### 3. `wavoip-call-webhook` — corrigir handler
- Ler `device_token` da query string (além do body).
- Aceitar payload oficial: `{ type:'CALL'|'RECORD'|'DEVICE', action, whatsapp_call_id, caller, receiver, direction:'INCOMING'|'OUTCOMING', duration, status, record_status, record_url }`.
- **CALL**: upsert único por `whatsapp_call_id` (já é o comportamento — apenas garantir que `CREATE` e `UPDATE` caem na mesma linha).
- **RECORD**: ao receber `record_status='READY'` com `record_url`, chamar `wavoip-fetch-recording` imediatamente (sem polling de 5 retries).
- **DEVICE**: atualizar `wavoip_devices.connection_status` (open→connected, close→disconnected).
- Se chegar evento sem `whatsapp_call_id`, **descartar** (não criar linha órfã).

### 4. Limpeza dos registros ruins
- Migration: `DELETE FROM wavoip_call_logs WHERE whatsapp_call_id IS NULL` (são exatamente as 24 linhas "started/encerrada" sem número da sua tela).

### 5. UI (`CallHistoryTab.tsx`)
- Mostrar "Aguardando webhook…" quando uma chamada ainda não tem registro (estado vazio inalterado).
- Causa `started` deixa de existir, então remover do mapeamento `statusInfo`.

## Detalhes técnicos
- Endpoint da Wavoip para webhook: documentação privada por dispositivo — usaremos `PUT https://api.wavoip.com/devices/webhook` (ou `/v1/devices/webhook`) com `Authorization: Bearer {device_token}` e body `{ url, events: ['CALL','RECORD','DEVICE'], enabled: true }`. A edge function tenta as variações conhecidas (mesmo padrão já usado em `wavoip-sync-history`).
- O `device_token` continua sendo a auth — vai pela query do callback porque a Wavoip não assina o webhook.
- `wavoip_call_logs.whatsapp_call_id` já tem unique index parcial → upsert atômico funciona.

## Memória
- Atualizar `mem/features/wavoip/call-history-sync.md`: webhook passa a ser a fonte primária; SDK só prefilla discador; poll vira backup raro; configuração de webhook é automática por dispositivo.
