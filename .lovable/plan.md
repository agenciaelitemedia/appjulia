## Regra de negócio (final)

Quando chega **mensagem nova inbound** de um contato:

| Estado da última conversa | Ação | Aba | Atribuído | Protocolo |
|---|---|---|---|---|
| `pending` ou `open` | Anexa nela (já funciona) | Atual | mantém | mantém |
| `resolved` | **Reabre** (`status=open`) | **Em atendimento** | **mantém o mesmo agente** | mantém |
| `closed` | **Cria nova** (`status=pending`, `assigned_to=null`) | **Em aberto / Pendentes** | **ninguém** | **NOVO** |
| Nenhuma | Cria nova `pending` sem dono | Em aberto | ninguém | novo |

Mensagens outbound (`fromMe=true`) só anexam — nunca reabrem nem criam.

## Estado atual do código

A lógica acima **já está implementada** nos três webhooks (`uazapi-chat-webhook`, `meta-webhook`, `instagram-webhook`) e a sequence de protocolo (`chat_conversation_protocol_seq`) gera novo número automaticamente em cada INSERT via trigger `trg_generate_conversation_protocol`. O índice único parcial `uniq_active_conversation_per_contact_queue_channel` impede duplicatas.

Você relatou no loop anterior: _"chegou nova conversa em uma que já tinha colocado como resolvida e ela não reabriu"_. Isso indica um caso real onde a regra não rodou. Preciso investigar **por que** antes de "consertar" código que aparentemente já está certo.

## Investigação a fazer (em modo build)

1. **Identificar o ticket que falhou**: consultar últimas conversas com status duplicado (uma `resolved` antiga e uma `pending` recente do mesmo `contact_id` + `queue_id` + `channel` criadas após o último deploy).
2. **Ler logs do webhook** correspondente no momento da chegada para ver qual branch foi tomado (anexou? criou nova? falhou o lookup do `resolved`?).
3. **Hipóteses prováveis a verificar**:
   - a) Mensagem chegou em **fila/canal diferente** do ticket resolved (ex.: contato encerrado no UaZapi e nova msg veio pela WABA Meta) → por design cria novo (isolamento por canal/fila). Se for esse o caso, alinhar contigo se quer flexibilizar.
   - b) Lookup de `resolved` filtra por `queue_id` exato — se o `queueId` resolvido pelo webhook estiver diferente do que estava no ticket original (ex.: fila renomeada/realocada), o `maybeSingle` retorna null e cai em "criar nova".
   - c) Race condition: webhook criou novo `pending` antes de checar `resolved` (improvável dado o índice único, mas possível em corridas raras).

## Mudanças propostas

### 1. Script de diagnóstico (read-only, executar primeiro)
Query nas conversas dos últimos dias para listar contatos com `resolved` antigo + `pending`/`open` novo no mesmo canal mas em `queue_id` diferente (ou igual). Vai mostrar exatamente o caso que falhou.

### 2. Ajuste de robustez no lookup de `resolved` (todos os webhooks)
Hoje o lookup exige **mesma `queue_id`**. Vou trocar para:
- Buscar `resolved` mais recente do mesmo `contact_id` + `client_id` + `channel` (sem amarrar à `queue_id`).
- Se a `queue_id` da conversa resolved diferir da `queueInfo.id` atual, **atualiza** a `queue_id` no reopen para a fila atual (mensagem chegou nessa fila agora).
- Mantém preservação do `assigned_to`.

Isso resolve o caso b (fila trocou) sem afetar o caso a (canal diferente continua sendo ticket novo, conforme `ticket-channel-isolation.md`).

### 3. Garantir refresh do protocolo nas novas conversas após `closed`
Hoje o trigger gera o novo protocolo no INSERT. Vou validar que o INSERT na branch "criar nova" envia `protocol: ''` (gatilho preenche) — já está assim nos 3 webhooks. Sem mudança.

### 4. Teste de fumaça
Após o ajuste, simular via SQL: marcar uma conversa real como `resolved`, disparar uma mensagem teste no canal e validar que o mesmo `id` ressuscita com `assigned_to` intacto. Repetir com `closed` e validar que sai novo `id` com novo protocolo e `assigned_to=null`.

## Arquivos a editar

- `supabase/functions/uazapi-chat-webhook/index.ts` — relaxar filtro `queue_id` no lookup de `resolved` + atualizar `queue_id` no reopen se mudou.
- `supabase/functions/meta-webhook/index.ts` — mesma mudança.
- `supabase/functions/instagram-webhook/index.ts` — mesma mudança.
- `mem/features/chat/conversation-reopen-rules.md` — documentar o relaxamento de `queue_id`.

## Detalhes técnicos

- O isolamento por **canal** (`channel`) é mantido — não junta WABA com UaZapi. Só a fila (`queue_id`) deixa de ser amarra dura no lookup do `resolved`.
- Reopen continua só em mensagem inbound (`fromMe=false`).
- Histórico (`chat_conversation_history`) ganha nota se a `queue_id` mudou no reopen.
- Nenhuma migração de banco necessária — só código de Edge Function.
