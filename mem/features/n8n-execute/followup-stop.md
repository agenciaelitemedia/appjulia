---
name: n8n Execute — Followup Stop
description: Edge function que para follow-ups ativos e limpa pré-followup para uma sessão WhatsApp
type: feature
---

**Function:** `n8n_execute-followup-stop`
**Action db-query:** `followup_stop`

## Propósito

Parar follow-ups pendentes e impedir novos disparos para um lead. Chamada por
`assignConversation` (assumir/transferir) via helper `disableJuliaOnAssignOrTransfer`
em `src/contexts/WhatsAppDataContext.tsx`, e também pelo helper legado
`supabase/functions/_shared/disableJuliaOnHumanSend.ts`.

## Parâmetros (body JSON)

- `codAgent` (string, obrigatório) — código do agente (`name_client` em `followup_queue`).
- `sessionId` (string, obrigatório) — número WhatsApp em qualquer formato.
  Normalizado em 13 e 12 dígitos via `brPhoneVariants`.

## Tabelas afetadas (Postgres externo)

- `public.followup_queue_temp` — `DELETE` por `cod_agent + session_id IN (13, 12)`.
- `public.followup_queue` — `UPDATE state='STOP', send_date = now() - INTERVAL '3 hours'`
  onde `state='SEND'` e `name_client + session_id IN (...)`.
- `public.agent_processing_status` — `DELETE` por `agent_id (= codAgent) + whatsapp_number IN (...)`.

## Resposta

```json
{
  "data": {
    "codAgent": "AG123",
    "phones": ["5534988860163", "553488860163"],
    "deleted_temp": 0,
    "updated_queue": 0,
    "deleted_status": 0
  },
  "error": null
}
```

## Invocação

```ts
await supabase.functions.invoke("n8n_execute-followup-stop", {
  body: { codAgent: "AG123", sessionId: "5534988860163" },
});
```