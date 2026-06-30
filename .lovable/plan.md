
## Mudanças em `/wavoip`

### 1. Estrutura em abas
Refatorar `src/pages/wavoip/WavoipPage.tsx` com `Tabs` (shadcn):
- **Aba "Meus dispositivos"** — todo o conteúdo atual (cards de plano, lista de dispositivos, dialog conectar QR, dialog adicionar).
- **Aba "Histórico"** — nova tabela de chamadas, no mesmo padrão visual da Telefonia (referência da imagem).

A tabela "Minhas chamadas" atual (resumida) é removida; o histórico completo passa a viver dentro da aba.

### 2. Aba "Histórico" — UI
Colunas (espelhando a tela de Telefonia da imagem):

```text
Origem | Atendente | Número discado | Iniciou às | Finalizou às | Duração | Causa | Tipo | Gravação
```

- **Origem**: badge "Wavoip" + link para abrir a conversa no chat (quando `to_number` mapeia para um contato).
- **Atendente**: nome do `app_user_id` (lookup em `users`).
- **Número discado**: `to_number` (outbound) ou `from_number` (inbound), formatado BR.
- **Iniciou/Finalizou**: `started_at` / `ended_at` (fallback `created_at`).
- **Duração**: `duration_seconds` em `mm:ss`.
- **Causa**: badge a partir de `status`/`end_reason` ("Atendida", "Cancelada", "Não atendida", "Falhou").
- **Tipo**: badge "Saída"/"Entrada" a partir de `direction`.
- **Gravação**: botão play se `recording_url` existir; mostra player inline (Popover com `<audio controls>` + botão "Baixar").

Filtros no topo: período (datepicker), tipo (todas/entrada/saída), causa (atendidas/perdidas/canceladas), busca por número. Paginação simples 50/pg.

Hook novo `useWavoipCallHistory` filtrando `wavoip_call_logs` por `client_id` (+ `app_user_id` para não-admin), com Realtime para atualizar quando webhook gravar nova linha.

### 3. Trazer gravação para o nosso Storage

A Wavoip disponibiliza a gravação em `https://storage.wavoip.com/{WHATSAPP_CALL_ID}` (pode demorar alguns minutos após o fim da chamada).

#### Migration (via `supabase--migration`)
- `ALTER TABLE public.wavoip_call_logs ADD COLUMN IF NOT EXISTS whatsapp_call_id text` (índice).
- `ADD COLUMN IF NOT EXISTS recording_url text` (URL pública do nosso storage).
- `ADD COLUMN IF NOT EXISTS recording_status text DEFAULT 'pending'` (`pending` | `downloading` | `available` | `unavailable` | `error`).
- `ADD COLUMN IF NOT EXISTS recording_downloaded_at timestamptz`.
- Criar bucket público `wavoip-recordings` via `storage.buckets` insert (idempotente) com policies de leitura pública.

#### Edge functions
- **Atualizar `wavoip-call-webhook`** (já existente):
  - Persistir `whatsapp_call_id` no insert/update.
  - Quando `status === 'ENDED'` (ou similar terminal com `duration > 0`), agendar download da gravação via `EdgeRuntime.waitUntil(downloadRecording(whatsapp_call_id, logId))`.
- **Nova `wavoip-fetch-recording`** (`supabase/functions/wavoip-fetch-recording/index.ts`):
  - Input: `{ call_log_id }` ou `{ whatsapp_call_id }`.
  - Faz `GET https://storage.wavoip.com/{whatsapp_call_id}`.
  - Se 404 ainda → marca `recording_status='pending'` e retorna 202.
  - Se 200 → faz upload para `wavoip-recordings/{client_id}/{whatsapp_call_id}.{ext}` com `service_role`, gera `getPublicUrl`, atualiza `wavoip_call_logs` com `recording_url`, `recording_status='available'`, `recording_downloaded_at=now()`.
  - Reentrante (idempotente por `whatsapp_call_id`).
- Registrar nos `supabase/config.toml` (já tem padrão `verify_jwt = false` para wavoip).

#### Botão "Buscar gravação"
Na linha do histórico, quando `recording_status` for `pending`/`unavailable`/`error`, mostrar botão ↻ que invoca `wavoip-fetch-recording`. Quando `available`, mostrar play.

Job opcional (não nesta entrega): cron a cada 10 min varrendo `recording_status='pending'` dos últimos 7 dias — deixar como item futuro mencionado no commit, mas não implementar agora.

### 4. Discoverability do webhook na Wavoip
Documentar (no `mem://technical/wavoip/qr-webphone-connection-flow.md` ou novo arquivo `mem://technical/wavoip/call-history-recordings.md`) que o operador precisa apontar o webhook do dispositivo na Wavoip (`https://app.wavoip.com/devices` → Integrações → Webhook) para a URL pública da nossa edge `wavoip-call-webhook`.

## Arquivos afetados
- `src/pages/wavoip/WavoipPage.tsx` — Tabs e separação do conteúdo.
- `src/pages/wavoip/components/MyDevicesTab.tsx` (novo) — conteúdo extraído (devices + dialogs).
- `src/pages/wavoip/components/CallHistoryTab.tsx` (novo) — tabela + filtros + player.
- `src/pages/wavoip/components/RecordingPlayer.tsx` (novo) — Popover com `<audio>` + download.
- `src/pages/wavoip/hooks/useWavoipCallHistory.ts` (novo) — query + Realtime.
- `supabase/functions/wavoip-call-webhook/index.ts` — gravar `whatsapp_call_id` e disparar fetch da gravação.
- `supabase/functions/wavoip-fetch-recording/index.ts` (novo) — baixa do `storage.wavoip.com` e sobe para o nosso bucket.
- Migração: novas colunas em `wavoip_call_logs` + criação do bucket `wavoip-recordings` (público) + policies.
- `mem/technical/wavoip/call-history-recordings.md` (novo) — fluxo de webhook + recording mirror.
- `mem/index.md` — adicionar entrada na seção Memories.

Sem alteração no fluxo de QR/conexão nem no `WavoipContext`.
