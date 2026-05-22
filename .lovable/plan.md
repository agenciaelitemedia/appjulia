## Diagnóstico

Investiguei os logs e o estado atual:

1. **Frontend (`MessageBubble.tsx`) está correto** — `StatusIcon` renderiza ✓ (sent), ✓✓ (delivered), ✓✓ azul (read) com base em `message.status`.

2. **Banco mostra que o status quase nunca avança de `sent`**:
   - Últimas 6h (from_me=true): **1166 sent / 2 delivered / 13 read**.
   - O pico de `read` aconteceu às 11h UTC (13) e 01h UTC (5); depois das 11h, **nenhum read/delivered novo**.

3. **Edge function `uazapi-chat-webhook` NÃO recebe `messages.update` há horas**. Os logs só mostram `Event: messages` (upsert). Não há nenhum `messages.update STATUS` nem `upsert STATUS bump`.

4. **A configuração do webhook na UaZapi inclui `messages.update`** (confirmado via `GET /webhook` em uma fila), mas mesmo assim os eventos de ACK não estão chegando. Isso indica que a instância UaZapi não está mais disparando esses eventos para nosso endpoint — provavelmente após algum redeploy ou pause/restore do servidor UaZapi, ou após alteração de webhook que zerou a subscrição efetiva apesar do GET retornar a lista correta.

5. **Não houve commit do código do webhook entre o momento que funcionou (madrugada) e agora** que justifique a quebra de lógica. As mudanças do dia foram: dropped logger, reabertura como `pending`, normalização de evento. Nenhuma altera o caminho de status update.

**Conclusão:** o problema não é código do app — é que a UaZapi parou de **entregar** os eventos `messages.update` para nosso webhook, mesmo que a configuração esteja registrada. Isso geralmente é resolvido **reaplicando** a configuração de webhook em todas as instâncias ativas (`POST /webhook` na UaZapi), que reativa a subscrição.

## Plano

### 1) Reaplicar webhook em todas as filas UaZapi ativas (correção imediata)

Adicionar uma nova action `reconfigure_webhook_all` na edge function `supabase/functions/uazapi-instance-manager/index.ts`:

- Lê todas as filas com `channel_type='uazapi'` e `is_active=true` que tenham `evo_apikey`.
- Para cada uma, chama `configureWebhook(...)` (que já manda `events: DEFAULT_WEBHOOK_EVENTS` incluindo `messages.update`).
- Retorna array `{ queue_id, name, ok, status }` com resultado por fila.
- Tolerante a falhas individuais (não aborta no primeiro erro).

Depois, executar essa action 1x via `supabase--curl_edge_functions`. Não cria UI nem cron — é um disparo único de manutenção.

### 2) Adicionar log defensivo para futuras quebras

No início do handler do webhook, logar uma vez por minuto (sampling) o `event` resolvido, para acelerar diagnóstico no futuro caso a UaZapi pare de enviar updates de novo. (Mudança pequena no `uazapi-chat-webhook/index.ts` — uma linha de console.log já existente cobre isso; sem novo código necessário.)

### 3) Validação

- Após reaplicar, enviar uma mensagem de teste numa fila e verificar nos logs de `uazapi-chat-webhook` se aparece `[uazapi-chat-webhook] messages.update STATUS { status: 'delivered'/'read', affected: 1 }`.
- Conferir no banco: `SELECT status, count(*) FROM chat_messages WHERE from_me=true AND created_at > now()-interval '15 min' GROUP BY 1;` — deve aparecer `delivered`/`read`.
- Visualmente: os ✓✓ devem voltar a ficar azuis quando o destinatário lê a mensagem.

### Fora do escopo

- Não tocar em `MessageBubble.tsx` (frontend está correto).
- Não alterar lógica de status no webhook (já estava correta antes e continua).
- Sem migrations.
