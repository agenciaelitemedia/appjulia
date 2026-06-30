## Objetivo

Garantir que toda chamada Wavoip (recebida ou efetuada) apareça automaticamente no Histórico em `/wavoip` ao terminar, com número, duração e gravação salva no nosso storage para reprodução — sem depender de o usuário recarregar a página ou de configuração externa frágil.

## Diagnóstico

Hoje já existe a infra básica:
- Tabela `wavoip_call_logs` (com `whatsapp_call_id`, `recording_url`, `recording_status`).
- Bucket privado `wavoip-recordings`.
- Edge function `wavoip-call-webhook` (recebe push da Wavoip, faz upsert por `whatsapp_call_id` e dispara busca da gravação).
- Edge function `wavoip-fetch-recording` (baixa de `https://storage.wavoip.com/{id}` para o bucket).
- Hook `useWavoipCallHistory` com Realtime.
- Aba "Histórico" com `RecordingPlayer`.

Pontos que estão furando a sincronização:
1. O listener do webphone (`WavoipContext`) insere uma linha NOVA a cada evento `call:*` (started/answered/ended), sem `whatsapp_call_id` — gera linhas duplicadas e desconectadas do webhook.
2. Esse mesmo listener nunca dispara `wavoip-fetch-recording`, então a gravação só chega se o webhook externo estiver configurado na conta Wavoip.
3. Se o webhook externo não estiver configurado (ou falhar), nada é sincronizado.

## Solução (3 camadas complementares)

### 1) Capturar `whatsapp_call_id` direto do SDK e fazer UPSERT
No `WavoipContext.tsx`, trocar o `insert` "burro" por um fluxo que:
- Ao receber `call:started/answered`, ler `wp.call.getCallActive()` → `{ id, device_token, direction, status, peer }` e fazer upsert por `whatsapp_call_id = id`.
- Manter um pequeno cache em memória `currentCallByDeviceToken` para correlacionar eventos sem `id` no payload.
- Persistir `from_number`/`to_number` a partir de `peer.number` + direção, e `device_id` resolvido pelo `device_token`.

### 2) Disparar fetch da gravação ao encerrar (frontend)
No mesmo listener, quando `call:ended/rejected`:
- Atualizar status/duração/ended_at na linha existente (mesmo `whatsapp_call_id`).
- Chamar `supabase.functions.invoke('wavoip-fetch-recording', { body: { whatsapp_call_id } })` com retry com backoff (5s, 15s, 30s, 60s, 120s) — porque a Wavoip leva alguns segundos para publicar o áudio em `storage.wavoip.com`.
- O `recording_status` evolui `pending → downloading → available`; a aba Histórico já reage via Realtime.

### 3) Poll de segurança (backend) para não perder nada
Nova edge function `wavoip-sync-history`:
- Recebe `{ device_token? , client_id? }` (sem args → varre todos os dispositivos `connected`).
- Consulta a API REST da Wavoip (`GET https://api.wavoip.com/calls?device_token=...&limit=50`) usando o token do dispositivo como auth.
- Faz upsert em `wavoip_call_logs` por `whatsapp_call_id` (preenche from/to, duration, started/ended, status, direction).
- Para cada chamada com `recording_status != 'available'`, chama `wavoip-fetch-recording` (com `EdgeRuntime.waitUntil`).
- Disparada por:
  - `pg_cron` a cada 5 min (`select net.http_post(...)` para todos os clientes ativos).
  - Botão "Sincronizar agora" na aba Histórico (chama via `supabase.functions.invoke`).

### 4) Higiene
- Migration para criar índice único parcial em `wavoip_call_logs (whatsapp_call_id)` (`WHERE whatsapp_call_id IS NOT NULL`) — viabiliza upsert atômico e bloqueia duplicatas.
- Migration para apagar/mesclar linhas legadas sem `whatsapp_call_id` que claramente são duplicatas (mesma `started_at±5s`, mesmo `device_id`).
- `RecordingPlayer` já lida com `pending` → adicionar polling leve (a cada 15s, até 3 min) para gerar URL assinada assim que `available`.

## Detalhes técnicos

- `wavoip-sync-history` autentica via `Authorization: Bearer <device_token>` (padrão Wavoip device API). Se o endpoint exato divergir, normalizamos lendo a doc da Wavoip e atualizamos o fetch.
- Retry no frontend usa `setTimeout` + `AbortController` cancelado ao desmontar; o estado de retry NÃO é guardado no servidor — a fonte da verdade é o `recording_status` do log.
- O upsert do frontend é seguro porque a RLS de `wavoip_call_logs` já permite o `app_user_id` dono da chamada inserir; conflitos são resolvidos pelo unique index e por `onConflict: 'whatsapp_call_id'`.
- O cron usa `pg_net` (já habilitado em outras integrações) chamando a URL pública da edge function com o service role no header.

## Critério de aceite

- Fazer uma chamada de saída pelo discador: aparece imediatamente em Histórico (status `started → answered → ended`), com número e duração corretos.
- Ao encerrar, em ≤2 min o player mostra "Reproduzir" (gravação no bucket `wavoip-recordings`).
- Receber uma chamada: idem, com `direction=inbound` e `from_number` do lead.
- Mesmo se o webhook externo da Wavoip estiver desligado, o poll de 5 min preenche e baixa as gravações faltantes.
- Não há linhas duplicadas por chamada.
