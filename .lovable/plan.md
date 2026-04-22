

# Plano Consolidado: Sincronização WhatsApp via UaZapi

Sim — vou implementar **tudo junto** numa única entrega: o fluxo completo de sincronização (etapas A e B), com as datas customizáveis no Step 2 já incluídas, mais a aba "Histórico de Sincronização".

## Fluxo do Wizard (`/configurações > Sincronizar WhatsApp`)

```text
1. Agente
2. Números (CRM)  ◄── COM seletores de data inicial/final
   • Data inicial: [01/01/2026 📅]   Data final: [hoje 📅]
   • Lista de números regenerada ao trocar datas
3. Cliente + Fila
4. Resumo (mostra período selecionado)
5. Aquecimento — /message/history-sync (rápido, progresso por número)
6. Importação — /message/find (background, 30min–3h)
```

## Etapa A — Aquecimento (`/message/history-sync`)

- `POST {evo_url}/message/history-sync` body `{ number: "<num>@s.whatsapp.net", count: 100 }` com header `token: evo_apikey`.
- Lotes de 5 números em paralelo, retry curto, progresso em tempo real (X/Y).
- Ao concluir, libera botão "Buscar Mensagens (Etapa B)".

## Etapa B — Importação (`/message/find` + persistência em background)

- Cria registro em `whatsapp_sync_jobs` (status `running`) e dispara edge function que retorna 200 imediato e processa via `EdgeRuntime.waitUntil`.
- Para cada número:
  - `POST {evo_url}/message/find` body `{ chatid, limit: 100, offset: 0 }`.
  - `chat_contacts`: upsert por (`client_id`, `phone`) — só insere se não existe.
  - `chat_messages`: upsert por `message_id` com `ignoreDuplicates: true` — evita réplica.
  - Atualiza contadores (`processed_numbers`, `inserted_messages`, `inserted_contacts`).
  - Grava log por número em `whatsapp_sync_job_logs`.
- Throttle: 3 paralelos + delay 200ms entre lotes.

## Aba "Histórico de Sincronização" (nova)

- Lista de jobs com: cliente / fila / agente / período / total / processados / mensagens / status / duração.
- Auto-refresh 5s para jobs ativos (React Query `refetchInterval`).
- Drawer ao clicar: tabela de logs por número (status, mensagens, erro).
- Ações: **Cancelar** (job running) e **Reexecutar números com erro**.

## Mudanças Técnicas

**Migrations**

```sql
-- whatsapp_sync_jobs
id uuid pk
client_id text, queue_id uuid, cod_agent text
phase text          -- 'history_sync' | 'message_find'
status text         -- 'running' | 'done' | 'error' | 'partial' | 'cancelled'
date_from date, date_to date
total_numbers int, processed_numbers int default 0
inserted_messages int default 0, inserted_contacts int default 0
started_at timestamptz, finished_at timestamptz
error text
created_by uuid, created_at timestamptz default now()

-- whatsapp_sync_job_logs
id uuid pk
job_id uuid fk -> whatsapp_sync_jobs (cascade)
phone text
status text         -- 'pending' | 'ok' | 'error' | 'skipped'
messages_found int default 0
messages_inserted int default 0
error text
processed_at timestamptz
unique(job_id, phone)
```
RLS: filtragem por `client_id` do usuário autenticado.

**Edge Functions (novas)**
- `uazapi-history-warmup` — síncrona, executa `/message/history-sync` em lotes.
- `uazapi-history-import` — assíncrona via `EdgeRuntime.waitUntil`, executa `/message/find` + persistência.
- `uazapi-history-cancel` — marca job como `cancelled` (worker checa flag entre lotes).

**Frontend**
- `SyncWhatsappTab.tsx`:
  - `StepNumbers`: 2 DatePickers (Popover + Calendar com `pointer-events-auto`), defaults `2026-01-01` → hoje, validação `dateFrom ≤ dateTo`. `dateFrom`/`dateTo` promovidos ao state do wizard.
  - `StepSummary`: nova linha "Período".
  - Step 5 (warmup) e Step 6 (import dispatch).
- `ConfiguracoesPage.tsx`: nova aba `<TabsTrigger value="sync-history">Histórico de Sincronização</TabsTrigger>`.
- Novos: `SyncHistoryTab.tsx`, `SyncHistoryLogsDrawer.tsx`.
- Hooks: `useWhatsappSyncJobs` (lista + auto-refresh), `useWhatsappSyncJobLogs(jobId)`, `useStartWarmup`, `useStartImport`, `useCancelSyncJob`.

## Garantias de Impacto

- **Idempotente**: rodar de novo não duplica (mensagem por `message_id`, contato por `client_id+phone`).
- **Sem timeout**: `waitUntil` desacopla do HTTP; usuário pode fechar a aba.
- **Throttle**: 3–5 chamadas paralelas evita rate-limit UaZapi.
- **Observável**: tudo visível na aba Histórico — sem precisar olhar logs do servidor.

