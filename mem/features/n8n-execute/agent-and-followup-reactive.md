---
name: n8n Execute — Agent & Followup Reactive
description: Reativa a sessão da Julia e reagenda o pré-followup para um lead
type: feature
---

**Function:** `n8n_execute-agent_and_followup-reactive`
**Action db-query:** `agent_and_followup_reactive`

## Propósito

Reativar a sessão da Julia para um contato e reagendar o pré-followup, garantindo
que nenhum follow-up ou pré-followup antigo continue ativo antes do reagendamento.

## Parâmetros (body JSON)

- `codAgent` (string, obrigatório) — código do agente (`name_client` em `followup_queue`).
- `whatsappNumber` (string, obrigatório) — número WhatsApp em qualquer formato.
  - Para busca (`SELECT`/`UPDATE`/`DELETE`) usa `brPhoneVariants` (13 + 12 díg).
  - Para o `INSERT` do temp usa `toBrCanonicalByDDD`:
    - DDD **< 30** → 13 dígitos (com o 9º dígito).
    - DDD **≥ 30** → 12 dígitos (sem o 9º dígito).
- `hubFila` (string, obrigatório) — `uazapi` ou `waba`.

## Passos (transação `sql.begin`)

1. **SELECT** em `public.sessions s JOIN public.agents a ON a.id = s.agent_id`
   filtrando por `a.cod_agent = codAgent` e `s.whatsapp_number IN (variantes)`,
   `ORDER BY s.id DESC LIMIT 1`. Retorna `session_id`, `agent_id` e
   `chat_memory = 'SessionID_' || cod_agent || '-' || whatsapp_number || '_' || id`.
   Se vazio → erro `sessão não encontrada`.
2. **UPDATE** `public.followup_queue` → `state='STOP', send_date=now()` onde
   `state='SEND'` e `name_client + session_id IN (variantes)`.
3. **DELETE** `public.followup_queue_temp` por `cod_agent + session_id IN (variantes)`.
4. **INSERT** uma linha em `public.followup_queue_temp` com
   `(session_id = whatsappNumberInsert, cod_agent, created_at=now() - interval '3 hours', hub=hubFila, chat_memory)`.
5. **UPDATE** `public.sessions SET active = TRUE WHERE id = session_id`.

## Resposta

```json
{
  "data": {
    "codAgent": "AG123",
    "phones": ["5534988860163", "553488860163"],
    "whatsappNumberInsert": "553488860163",
    "hubFila": "uazapi",
    "session_id": 371706,
    "agent_id": 202605012,
    "chat_memory": "SessionID_AG123-5534988860163_371706",
    "updated_queue": 0,
    "deleted_temp": 0,
    "inserted_temp": 1,
    "session_activated": true
  },
  "error": null
}
```

## Invocação

```ts
await supabase.functions.invoke("n8n_execute-agent_and_followup-reactive", {
  body: { codAgent: "AG123", whatsappNumber: "5534988860163", hubFila: "uazapi" },
});
```