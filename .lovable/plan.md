

## Plano final: filtro anti-eco entre filas do mesmo cliente, com auto-resolução de números

### Comportamento confirmado
- Contatos externos com mesmo telefone em filas diferentes continuam aparecendo como atendimentos separados (comportamento desejado)
- Apenas mensagens entre **números do próprio cliente** (UaZapi ↔ WABA do mesmo `client_id`) são descartadas
- **Nenhum input manual de número** — sempre auto-resolvido via API do provedor

### Auto-resolução de números

**WABA (Meta)**: chamar `GET https://graph.facebook.com/v22.0/{phone_number_id}` com `Bearer {access_token}` retorna `display_phone_number` no formato `+55 34 9163-3679`. Normalizar para E.164 puro `553491633679`.

**UaZapi**: chamar `GET {evo_url}/instance/status` (ou `/instance/info`) com header `token: {evo_apikey}` retorna `instance.owner` no formato `553488860163@s.whatsapp.net`. Extrair só os dígitos.

### Passos

#### 1. Migration: schema
- `ALTER TABLE queues ADD COLUMN phone_number text` (E.164, nullable)
- `ALTER TABLE queues ADD COLUMN phone_resolved_at timestamptz` (controle de quando foi resolvido pela última vez)
- Índice parcial em `(client_id, phone_number) WHERE phone_number IS NOT NULL` para lookup rápido no webhook

#### 2. Edge function nova: `queue-resolve-phone`
Recebe `{ queue_id }`. Lê a fila, identifica `channel_type`, chama API do provedor para obter o número real, faz `UPDATE queues SET phone_number=..., phone_resolved_at=now()`. Retorna `{ phone_number }`.
- Para WABA: `GET /v22.0/{waba_number_id}` → `display_phone_number` → strip non-digits
- Para UaZapi: `GET /instance/status` com fallback para `/instance/info` → `instance.owner` → strip non-digits

#### 3. Auto-disparo da resolução
- **Ao criar fila** (em `useQueueMutations.createQueue` ou wizard de criação): após insert da fila, chamar `queue-resolve-phone` em background (fire-and-forget). Sem bloquear UI.
- **Ao conectar instância UaZapi** (em `useConnectionActions.connect` `onSuccess`): re-resolver para capturar o owner que só existe após pareamento
- **Backfill one-shot** via insert tool: chamar resolução para as 2 filas existentes (client 30 — `mario` e `Meta Official`) imediatamente após deploy

#### 4. Filtro anti-eco em `uazapi-chat-webhook/index.ts`
Antes do upsert de `chat_contacts` (linhas ~340-380), carregar uma vez por execução do handler:
```ts
const { data: ownNumbers } = await supabase
  .from('queues')
  .select('phone_number')
  .eq('client_id', queue.client_id)
  .not('phone_number', 'is', null);
const ownSet = new Set(ownNumbers.map(q => q.phone_number));

// dentro do loop de mensagens:
const phoneDigits = jid.replace(/\D/g, '');
if (ownSet.has(phoneDigits)) {
  console.log(`[uazapi-chat-webhook] skip self-conversation phone=${phoneDigits}`);
  continue;
}
```

#### 5. Filtro simétrico em `meta-webhook/index.ts`
Mesma lógica no laço `messages` do payload Meta — descartar quando `from` bater com algum `phone_number` do client.

#### 6. Limpeza one-shot dos contatos-fantasma
Via insert tool, no client 30:
- Deletar `chat_messages` dos contatos cujo `phone IN ('553491633679','553488860163')` quando a fila do contato é a "errada" (ou seja, contato `553491633679` em fila UaZapi `mario`, e contato `553488860163` em fila WABA `Meta Official`)
- Deletar `chat_conversations` desses contatos
- Deletar os contatos

### Arquivos afetados
- **migration**: nova coluna `phone_number` + `phone_resolved_at` + índice
- **insert tool**: backfill da resolução + limpeza dos fantasmas
- `supabase/functions/queue-resolve-phone/index.ts` — **nova** edge function
- `supabase/functions/uazapi-chat-webhook/index.ts` — filtro anti-eco
- `supabase/functions/meta-webhook/index.ts` — filtro anti-eco
- `src/pages/agente/filas/hooks/useQueues.ts` (ou wizard correspondente) — disparar `queue-resolve-phone` após criação
- `src/pages/agente/meus-agentes/hooks/useConnectionActions.ts` — re-disparar após connect bem-sucedido da UaZapi
- **mem://**: nova memory `mem://features/chat/anti-echo-self-conversation` documentando a regra

### Resultado esperado
1. Após deploy + backfill: contatos `553491633679` (na fila mario) e `553488860163` (na fila Meta Official) somem do `/chat` do client 30
2. Novas mensagens entre os 2 números próprios são descartadas silenciosamente em ambos os webhooks
3. Conversas reais com clientes externos não são afetadas (mesmo se um cliente externo conversar pelos 2 canais — cada fila mostra normalmente)
4. Operador não precisa preencher nada — número é resolvido automaticamente via API do provedor
5. Logs do webhook mostram `skip self-conversation phone=...` quando o filtro atua

### Riscos / mitigações
- **UaZapi `owner` só existe após pareamento**: se a fila for criada e nunca conectada, `phone_number` fica `NULL` e o filtro não atua para ela. Aceitável — sem pareamento, ela não recebe mensagens mesmo. Re-resolvemos no `connect`.
- **Token WABA inválido**: resolução falha silenciosamente, fila fica sem `phone_number`. Logamos warning. Sem impacto em conversas reais.
- **Contato externo com mesmo número de uma fila do cliente**: cenário extremamente raro (cliente externo teria que ter o mesmo número WhatsApp que o escritório). Aceito como falso-positivo — filtramos por client_id, então só afeta o próprio cliente.

