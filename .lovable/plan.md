## Diagnóstico

Verifiquei o fluxo de criação de fila WABA:

1. **Client-side** (`QueueWizardDialog.tsx`) — após criar a fila, dispara `waba-admin` action `subscribe_queue`. Se falhar, apenas mostra um `toast.warning` genérico ("Fila criada, mas falhou ao inscrever o webhook"), engolindo o erro real vindo do Meta.
2. **Server-side** (`waba-admin/subscribe_queue`) — faz 3 chamadas:
   - `POST /{waba_id}/subscribed_apps` (assina o app à WABA)
   - `GET /{waba_id}/subscribed_apps` (confirma)
   - `POST /{META_APP_ID}/subscriptions` (registra o callback no app)
3. Nenhum log recente de `waba-admin` nem de `meta-webhook` para as WABAs afetadas (`1032123039771642` — BPC/LOAS de 08/07 e `1062909349731148` — TESTE API de 06/07), confirmando que a inscrição não completou ou nunca chegou a rodar (usuário pode ter fechado a modal antes do onSuccess).

## Causa provável

A inscrição é executada apenas no `onSuccess` da mutation client-side. Se a modal fecha antes, se o `waba-admin` retorna erro (ex.: token do Embedded Signup sem permissão `whatsapp_business_management`), ou se a rede cai, a fila fica criada **sem webhook inscrito** e a mensagem de erro real fica escondida.

## Plano de correção

### 1. Mover a auto-inscrição para o server (`queue-management`)
Após inserir a fila WABA no banco, chamar internamente `waba-admin/subscribe_queue` no mesmo edge function que já cria a fila. Assim independe do navegador/UI e fica logado no servidor.

### 2. Expor o erro real no client
No `QueueWizardDialog.tsx`, quando `subscribe_queue` retornar `success:false`, mostrar `data.error` / `data.webhook_warning` no toast, em vez de mensagem genérica. Isso ajuda a diagnosticar tokens vencidos, permissões faltantes, etc.

### 3. Retry automático + persistência de status
- Adicionar coluna `waba_webhook_status` (`pending|subscribed|failed`) e `waba_webhook_last_error` em `queues`.
- Marcar `pending` na criação; `subscribed` quando `subscribed_apps GET` confirma; `failed` com mensagem se erro.
- Retry uma vez após 3s no server em caso de falha transitória.

### 4. Botão "Reinscrever webhook Meta" (já existe) — melhorar
Mostrar em destaque no `QueueCard` das filas WABA quando `waba_webhook_status != 'subscribed'` (badge amarelo "Webhook não inscrito"), para o usuário resolver com 1 clique.

### 5. Rotina em massa
Nova ação `waba-admin/subscribe_all_pending` — varre todas as filas WABA com `waba_webhook_status != 'subscribed'` e reinscreve. Chamar 1x agora nas 2 filas afetadas (BPC/LOAS e TESTE API).

## Detalhes técnicos

```text
queue-management (create WABA queue)
  ├─ INSERT into queues
  ├─ UPDATE queues SET waba_webhook_status='pending'
  └─ invoke('waba-admin', {action:'subscribe_queue', queueId})
        ├─ success → UPDATE waba_webhook_status='subscribed'
        └─ error   → retry once → UPDATE 'failed' + last_error
```

Migration adiciona 2 colunas + backfill `'subscribed'` para filas WABA que já têm webhook funcionando (opcional: marca `NULL` e roda `subscribe_all_pending`).

## Fora do escopo

- Rotação de token WABA (o token é permanente do system user).
- Alterações no `meta-webhook` (roteamento por `waba_number_id` está correto).