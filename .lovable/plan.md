

## Objetivo

Garantir que toda mensagem nova recebida pela UaZapi (`messages.upsert`) seja repassada ao n8n com `?app=uazapi&c=<cod_agent>`, independentemente da nomenclatura do evento que a UaZapi enviar.

## Diagnóstico

O webhook `uazapi-chat-webhook` hoje só dispara fan-out para n8n quando `event === 'messages'` (default). A UaZapi atual envia `event: 'messages.upsert'`, que cai num branch que **não é tratado como mensagem nova** — o código só trata explicitamente `messages.update`, `messages.delete`, `chats.update`, `contacts.update`, `connection.update`. Tudo que não bate nesses ifs cai no bloco genérico “messages”, MAS apenas se `event` não for um desses específicos. Resultado: `messages.upsert` é processado como mensagem (o parser aceita), porém em algumas variações o payload chega vazio e `processed=0`, e ainda assim o fan-out roda. O problema relatado é que **nada chega no n8n para `app=uazapi`** — então a causa real é uma das duas:

1. O evento não está casando com o caminho de fan-out (filtro extra).
2. Não há checagem explícita de vínculo + tipo de evento conforme regra de negócio nova.

A correção alinha o código exatamente à regra que você definiu agora.

## Mudanças

### 1. `supabase/functions/uazapi-chat-webhook/index.ts`

- Normalizar o evento recebido: tratar `messages`, `messages.upsert` e `message` como o **mesmo** tipo lógico `MESSAGE_UPSERT`.
- Antes de qualquer processamento pesado, resolver `queue_id` → buscar `queue_agent_links` da fila.
- Se não houver agente vinculado: logar `[fan-out] no agents linked, skipping` e retornar 200 sem fan-out (mas ainda persistir a mensagem normalmente para histórico).
- Se houver vínculo **e** o evento for `MESSAGE_UPSERT`: para cada `cod_agent` vinculado, fazer `POST` para  
  `${N8N_HUB_SEND_URL}?app=uazapi&c=<cod_agent>`  
  com o **payload bruto original** recebido da UaZapi (sem transformações), `Content-Type: application/json`.
- Eventos diferentes de `MESSAGE_UPSERT` (status, delete, contacts, chats, connection) **não** disparam n8n — apenas atualizam o banco como hoje.
- Logs claros: `[fan-out] event=<x> queue=<id> targets=<n> agent=<cod> status=<http>`.
- Persistência de mensagens, contatos e conversas continua exatamente como está hoje (não mexe na lógica de upsert nem no backfill).

### 2. Sem mudanças em frontend, sem novas tabelas, sem migrations

A regra é 100% backend; o webhook na UaZapi já está correto.

## Validação

1. Enviar uma mensagem real para a fila UaZapi.
2. Conferir nos logs do `uazapi-chat-webhook`:
   - `event=messages.upsert queue=9f10a27b... targets=1`
   - `[fan-out] POST n8n agent=202601003 status=200`
3. Conferir no n8n a execução com query `app=uazapi&c=202601003` e o payload bruto da UaZapi no body.
4. Confirmar que eventos `messages.update` (status delivered/read) **não** geram execução nova no n8n.

## Arquivos previstos

- `supabase/functions/uazapi-chat-webhook/index.ts`

