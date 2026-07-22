# n8n_execute

Grupo de funções migradas do n8n para Edge Functions do projeto.
Cada função vive em uma pasta própria `supabase/functions/n8n_execute-<nome>/`
(pasta direta é exigência do Supabase CLI). O agrupamento lógico fica aqui.

## Convenções

- Nome da Edge Function: `n8n_execute-<nome-kebab>`.
- Entrada: JSON via `POST` (`body`).
- Retorno padrão: `{ data, error }` (mesmo envelope do `db-query`).
- Acesso ao Postgres externo: sempre via `db-query` (action dedicada),
  nunca conexão direta (ver `mem://technical/edge-functions/external-db-connection-logic`).
- Normalização BR de telefones: `supabase/functions/_shared/phone-normalize.ts`
  (`brPhoneVariants` gera 12 e 13 dígitos).
- Memória mestre: `mem://features/n8n-execute/index`.

## Funções

### 1) Followup Stop

- **Function:** `n8n_execute-followup-stop`
- **Action db-query:** `followup_stop`
- **Memória:** `mem://features/n8n-execute/followup-stop`
- **Propósito:** parar follow-ups ativos e impedir novos disparos para uma sessão WhatsApp.
- **Parâmetros (body JSON):**
  - `codAgent` (string, obrigatório) — código do agente (`name_client` em `followup_queue`).
  - `sessionId` (string, obrigatório) — número WhatsApp (qualquer formato). Normalizado em 13 e 12 dígitos.
- **Tabelas afetadas (Postgres externo):**
  - `public.followup_queue_temp` — `DELETE` por `cod_agent` + `session_id IN (13, 12)`.
  - `public.followup_queue` — `UPDATE state='STOP', send_date = now() - 3h` onde `state='SEND'` e `name_client + session_id IN (...)`.
  - `public.agent_processing_status` — `DELETE` por `cod_agent` + `session_id IN (...)`.
- **Resposta:**
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
- **Invocação:**
  ```ts
  import { supabase } from "@/integrations/supabase/client";
  await supabase.functions.invoke("n8n_execute-followup-stop", {
    body: { codAgent: "AG123", sessionId: "5534988860163" },
  });
  ```

### 2) Agent & Followup Reactive

- **Function:** `n8n_execute-agent_and_followup-reactive`
- **Action db-query:** `agent_and_followup_reactive`
- **Memória:** `mem://features/n8n-execute/agent-and-followup-reactive`
- **Propósito:** reativar a sessão da Julia para um lead e reagendar o pré-followup, garantindo que nenhum follow-up ou pré-followup antigo continue ativo.
- **Parâmetros (body JSON):**
  - `codAgent` (string, obrigatório) — código do agente (`name_client` em `followup_queue`).
  - `whatsappNumber` (string, obrigatório) — número WhatsApp (qualquer formato). Normalizado em 13 e 12 dígitos para busca; para o INSERT usa a regra do DDD (DDD < 30 → 13 dígitos com o 9º; DDD ≥ 30 → 12 dígitos sem o 9º).
  - `hubFila` (string, obrigatório) — `uazapi` ou `waba`.
- **Tabelas afetadas (Postgres externo, tudo em transação):**
  - `public.sessions` + `public.agents` — `SELECT` para obter `session_id`, `agent_id` e `chat_memory` (`'SessionID_' || cod_agent || '-' || whatsapp_number || '_' || id`).
  - `public.followup_queue` — `UPDATE state='STOP', send_date=now()` onde `state='SEND'` e `name_client + session_id IN (13, 12)`.
  - `public.followup_queue_temp` — `DELETE` por `cod_agent + session_id IN (13, 12)`.
  - `public.followup_queue_temp` — `INSERT` de 1 linha com `(session_id=whatsappNumberInsert, cod_agent, created_at=now(), hub=hubFila, chat_memory)`.
  - `public.sessions` — `UPDATE active=TRUE WHERE id = session_id`.
- **Resposta:**
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
- **Invocação:**
  ```ts
  import { supabase } from "@/integrations/supabase/client";
  await supabase.functions.invoke("n8n_execute-agent_and_followup-reactive", {
    body: { codAgent: "AG123", whatsappNumber: "5534988860163", hubFila: "uazapi" },
  });
  ```