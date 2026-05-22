## Diagnóstico

Investiguei os 2 exemplos (`5584994043110` e `5527988540598`) no banco. Em ambos o histórico mostra exatamente o mesmo padrão:

```
assigned       → Ana Luiza / Raquel Souza
reopened       → open
auto_returned  → status=pending, assigned_to=NULL  (NRT vencido)
resolved       → VICTORIA / ADRIELE resolveu
reopened       → status=open (webhook)             ← BUG aqui
```

A conversa fica `status=open` **com `assigned_to=NULL`** porque o `auto_returned` zerou o responsável antes do `resolved`, e quando o cliente respondeu o webhook reabriu como `open` sem reavaliar.

### Causas-raiz encontradas

1. **Reabertura no webhook (UaZapi, Meta/WABA, Instagram)** — sempre seta `status='open'` na reabertura, ignorando o caso em que `assigned_to` está vazio. O comentário "atribuição mantida" é verdadeiro, mas se a atribuição já era `NULL` (por causa do `auto_returned`) a conversa volta como "Em atendimento" sem dono. **Correto:** se `assigned_to` está vazio, reabrir como `pending` (Aguardando atendimento).

2. **`getOrCreateConversation` no front (`WhatsAppDataContext.tsx` ~L940)** — quando o atendente abre um contato sem conversa ativa, cria nova com `status='open'` e **sem** `assigned_to`. Também não tenta reabrir uma `resolved` existente. Gera "Em atendimento" fantasma sem dono.

3. **Primeira resposta do agente (`WhatsAppDataContext.tsx` ~L1485)** — promove `pending → open` ao gravar `first_response_at`, mas **não** seta `assigned_to`. Resultado: conversa "Em atendimento" sem responsável.

4. **Classificação na lista (`ChatList.tsx` + `WhatsAppDataContext.tsx`)** — hoje só faz upgrade `pending+assignee → open`, mas não faz o downgrade simétrico `open sem assignee → pending`. Sem defesa em profundidade, qualquer ressíduo histórico continua na aba errada.

### Sobre "resolvidos aparecendo em Meus Atendimentos"

O dedupe por contato (`useContactLatestConversation`) usa o ticket-líder pelo `updated_at`. Hoje o líder pode ser `open` (o bugado) enquanto a UI do `ChatContactItem` lê um `resolved_at` antigo para o badge de status. A correção da causa-raiz (1) elimina a maioria desses casos; a correção (4) garante isolamento por aba mesmo com dados antigos.

---

## Plano de correção

### Backend (edge functions)

**`supabase/functions/uazapi-chat-webhook/index.ts`** (~L1398-1416)
- Ao reabrir conversa `resolved`: ler também `assigned_to`. Definir
  `newStatus = (assigned_to && assigned_to.trim()) ? 'open' : 'pending'`.
- Ajustar `notes` do `chat_conversation_history` quando voltar como `pending` ("Cliente respondeu após resolução — sem responsável, devolvida à fila").

**`supabase/functions/meta-webhook/index.ts`** (~L240-267) — mesma alteração.

**`supabase/functions/instagram-webhook/index.ts`** (~L135-162) — mesma alteração.

### Frontend

**`src/contexts/WhatsAppDataContext.tsx`**

1. `getOrCreateConversation` (~L846-980):
   - Antes de criar nova conversa, procurar `resolved` mais recente do mesmo `(contact, client, channel)` e reabrir (status conforme regra: `open` se já tinha dono, senão `pending`).
   - Se de fato criar nova: usar `status: 'pending'` e `assigned_to: null` (alinhar com regra de webhook). Promover para `open` só quando o atendente realmente assumir.

2. Envio de primeira mensagem (~L1485-1493):
   - Quando promover `first_response_at`, também setar `assigned_to = user.name` **se** a conversa não tem responsável ainda. Registrar `assigned` em `chat_conversation_history`.

**`src/components/chat/ChatList.tsx`** (badges ~L786 e lista visível ~L840) e **`src/contexts/WhatsAppDataContext.tsx`** (`convCounts` ~L838 e `filteredContacts` ~L2232):
- Trocar a regra de status efetivo para:
  ```
  hasAssignee = !!assigned_to?.trim()
  effective =
    status === 'pending' && hasAssignee ? 'open' :
    status === 'open'    && !hasAssignee ? 'pending' :
    status
  ```
- Garante coerência visual mesmo para tickets antigos: `open` sem dono passa a aparecer em **Aguardando atendimento**; `resolved`/`closed` continuam isolados na aba Resolvidos/Encerrados.

### Migração de dados (one-shot)

Migration para normalizar o passivo:

```sql
UPDATE chat_conversations
SET status = 'pending', updated_at = now()
WHERE status = 'open'
  AND (assigned_to IS NULL OR btrim(assigned_to) = '');
```

Registrar uma entrada em `chat_conversation_history` (`action='normalized'`, `notes='Backfill: open sem responsável reclassificado como pending'`) para auditoria das linhas afetadas.

### Regra documentada (memo)

Atualizar `mem/features/chat/conversation-reopen-rules.md` cobrindo o novo caso: quando a conversa `resolved` foi reaberta após `auto_returned`, ela volta como **`pending`** (não `open`), pois o dono original já tinha sido removido pelo monitor de NRT.

---

## Resultado esperado

- "Em atendimento" mostra somente conversas com responsável.
- "Aguardando atendimento" recebe automaticamente o que ficou sem dono (inclui reaberturas pós-`auto_returned`).
- Resolvidos/Encerrados continuam isolados na sua aba.
- Reabrir conversa que ainda tinha dono → permanece com o mesmo dono (regra original preservada).
