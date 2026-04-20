

## Objetivo
Substituir o seletor "UaZapi vs API Oficial" no `/agente/meus-agentes` por **"QR Code (UaZapi)" vs "Filas"**. Ao selecionar Filas, o usuário escolhe uma fila existente; o sistema vincula a fila ao agente e configura o redirecionamento dos eventos da fila para o webhook do n8n do agente, replicando o comportamento do WABA atual.

## Diagnóstico

**Estado atual:**
- `ProviderSelector.tsx` já oferece duas opções: **QR Code (UaZapi)** e **Filas** (via `QueueConnectionDialog`). O componente `QueueConnectionDialog` já existe.
- `ConnectionControlButtons.tsx` ainda referencia caminho WABA (`WabaSetupDialog`, `waba-admin disconnect`) no estado `disconnected`/`waba_connected`. Isso precisa ser ajustado para o novo modelo "Filas".
- `meta-webhook` (WABA) já encaminha eventos para o webhook n8n do agente com `app=waba` + dados WABA. Precisa replicar para filas.
- Filas UaZapi recebem webhooks via endpoint próprio (a confirmar — provavelmente `uazapi-webhook` ou similar). Precisa adicionar lógica de fan-out: para cada agente vinculado à fila, encaminhar payload ao webhook do n8n do agente.

**Pontos a confirmar via código:**
1. Como `queue_agent_links` está estruturado (já aparece em `sync-queue-to-agent`).
2. Onde está o webhook receiver UaZapi para filas e como ele resolve o destino n8n hoje.
3. Como `agents.webhook_n8n` (ou equivalente) é lido no `meta-webhook` para o forward.

## Mudanças

### 1. Frontend — `ProviderSelector.tsx`
- Já está correto (QR Code + Filas). **Sem mudança**.

### 2. Frontend — `QueueConnectionDialog.tsx` (verificar/ajustar)
- Listar filas disponíveis (`queues` table) com badge do tipo (UaZapi / API Oficial).
- Ao confirmar:
  - Criar registro em `queue_agent_links` (queue_id + cod_agent).
  - Atualizar `agents` row: setar `hub` = `'queue'` (novo valor) com referência à `queue_id` em campo dedicado (ex: `linked_queue_id`), preservando UaZapi/WABA legados.

### 3. Schema — adicionar suporte a "linked queue" no agente
- Migration: adicionar coluna `linked_queue_id uuid` em `agents` (banco externo) — ou usar `queue_agent_links` como fonte única (preferido, já existe).
- Se usar somente `queue_agent_links`, o status do agente passa a ser derivado: "se existe link → conectado via fila".

### 4. Frontend — `ConnectionControlButtons.tsx` + `useConnectionStatus.ts` + `types.ts`
- Adicionar novo `ConnectionStatus`: `'queue_connected'`.
- `useConnectionStatus`: consultar `queue_agent_links` para o `cod_agent`; se houver vínculo, retornar `queue_connected` + nome/tipo da fila.
- `ConnectionControlButtons`:
  - Status `queue_connected`: mostrar "Conectado via fila X (UaZapi/Oficial)" + botão "Desvincular fila".
  - Status `disconnected` com link de fila: substituir caminho WABA pelo de fila.
- `types.ts`: incluir `linked_queue_id?: string | null` e `linked_queue_type?: 'uazapi' | 'waba'` em `UserAgent`.

### 5. Backend — Edge function: `queue-link-agent` (novo) ou ajustar `sync-queue-to-agent`
- Action: receber `{ queue_id, cod_agent }` → criar/remover row em `queue_agent_links`.
- Não precisa mais escrever credenciais na tabela `agents` (a fila é a fonte). Manter `sync-queue-to-agent` apenas para casos UaZapi legados.

### 6. Backend — Webhook fan-out das filas para o n8n do agente
**Caminho A (UaZapi via fila):**
- Localizar/criar handler de webhook para filas UaZapi (ex: `uazapi-webhook?queue_id=...`).
- Lógica: 
  1. Receber payload UaZapi.
  2. Buscar todos `queue_agent_links` para `queue_id`.
  3. Para cada `cod_agent`, buscar `webhook_n8n` em `agents`.
  4. Forward `POST` ao n8n com payload original + `?app=uazapi&c=<cod_agent>` (querystring conforme solicitado).

**Caminho B (WABA via fila):**
- Em `meta-webhook` (que já distribui por `waba_id`/`phone_number_id`):
  1. Após resolver agente pela fila (lookup em `queues` por `waba_id`), iterar `queue_agent_links`.
  2. Forward ao webhook n8n de cada agente vinculado com `?app=waba&waba_id=<id>`.

**Implementação compartilhada:** criar helper `forwardToAgentN8n(codAgent, payload, params)` reutilizado pelos dois webhooks.

### 7. Comportamento legado preservado
- Agentes com `hub='uazapi'` (QR Code direto) continuam funcionando exatamente como hoje — a lógica nova só é acionada quando há registro em `queue_agent_links`.
- Agentes com `hub='waba'` direto (sem fila) continuam usando `meta-webhook` como hoje.

## Arquivos afetados

**Frontend:**
- `src/pages/agente/meus-agentes/types.ts` — novo status + campos.
- `src/pages/agente/meus-agentes/hooks/useConnectionStatus.ts` — checar fila vinculada.
- `src/pages/agente/meus-agentes/hooks/useUserAgents.ts` — fetch de `queue_agent_links` join.
- `src/pages/agente/meus-agentes/components/ConnectionControlButtons.tsx` — branch `queue_connected`.
- `src/pages/agente/meus-agentes/components/QueueConnectionDialog.tsx` — confirmar UI/fluxo.

**Backend (Edge Functions):**
- `supabase/functions/queue-link-agent/index.ts` — novo (vincular/desvincular).
- `supabase/functions/uazapi-webhook/index.ts` ou similar — adicionar fan-out por fila.
- `supabase/functions/meta-webhook/index.ts` — adicionar fan-out por fila (quando `phone_number_id` pertence a uma fila).
- `supabase/functions/_shared/forward-to-agent-n8n.ts` — helper.

## Diagrama do fluxo

```text
[Mensagem WhatsApp]
       │
       ├─── UaZapi cloud ──► uazapi-webhook(queue_id)
       │                          │
       │                          ├─ link existe? ──► n8n agente (?app=uazapi&c=<cod>)
       │                          └─ não           ──► comportamento atual
       │
       └─── Meta WABA   ──► meta-webhook
                                  │
                                  ├─ waba_id ∈ queue? ──► n8n agentes vinculados (?app=waba&waba_id=<id>)
                                  └─ agente direto    ──► comportamento atual
```

## Confirmações antes de implementar
- Nome/local exato do webhook UaZapi de filas.
- Nome do campo `webhook_n8n` (ou similar) na tabela `agents`.

