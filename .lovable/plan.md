## Problema

Quando o webhook reabre uma conversa que estava `resolved` (passa para `status = 'open'`, mantém `assigned_to`), ela **não aparece imediatamente** na aba "Em aberto" do atendente. O usuário precisa trocar de filtro / dar refresh para vê-la.

## Causa raiz

Em `src/contexts/WhatsAppDataContext.tsx`:

1. `loadConversations` busca **apenas** `status IN ('pending','open')` quando o filtro é "Em aberto" (`convQueryGroup === 'active'`). Conversas `resolved` **não estão no estado local**.
2. O canal realtime `chat_conversations_changes` trata `UPDATE` assim:
   ```ts
   setConversations(prev => prev.map(c => (c.id === updConv.id ? updConv : c)));
   ```
   Como a conversa `resolved` reaberta **nunca foi carregada** (não está em `prev`), o `.map` é no-op — nada entra na lista. Só acontece a alteração se o usuário estiver na aba "Resolvidas" no momento da reabertura.
3. O mesmo problema afeta o caminho inverso (sair de "Em aberto" para `resolved`/`closed` enquanto o usuário está na aba ativa — ela continua visível indevidamente até reload).

## Correção

Tornar o handler de `UPDATE` **consciente do filtro atual** (`convQueryGroupRef`) e dos `activeQueueIds`, com semântica "upsert / remove":

```text
ao receber UPDATE de chat_conversations:
  decidir se a conversa "pertence" ao grupo atualmente carregado:
    grupo 'active'   → status IN ('pending','open')
    grupo 'resolved' → status = 'resolved'
    grupo 'closed'   → status = 'closed'
  + respeitar currentQueueId / activeQueueIds (queue não deletada)

  se pertence:
    se já está em prev → substituir (comportamento atual)
    se NÃO está em prev → INSERIR no topo (reposicionar por updated_at)
  se NÃO pertence:
    remover de prev (caso esteja lá — ex: foi resolvida em outra aba)
```

Isso resolve os dois lados: reabertura aparece na hora; encerramento some na hora.

## Mudanças

### 1. `src/contexts/WhatsAppDataContext.tsx`

- Criar um `convQueryGroupRef = useRef(convQueryGroup)` mantido sincronizado por um `useEffect`, para o handler realtime ler o valor mais recente sem precisar resubscrever.
- No handler do canal `chat_conversations_changes`:
  - Extrair helper `belongsToCurrentGroup(conv)` que valida status + queue.
  - No branch `UPDATE` (e tratar `INSERT` de forma consistente):
    - Se `belongsToCurrentGroup` → upsert (substitui se existe, senão insere ordenado por `updated_at desc`).
    - Caso contrário → `prev.filter(c => c.id !== updConv.id)`.
- Manter o comportamento de remover quando a queue ficou soft-deleted.
- Garantir que o `useEffect` que cria o canal **não** dependa de `convQueryGroup` (evita derrubar/recriar a subscription a cada troca de aba) — usar a `ref`.

### 2. Webhooks (defesa em profundidade)

Já estão corretos hoje (reopen seta `status='open'`, `resolved_at=null`, `updated_at=now()`), mas garantir explicitamente que o `UPDATE` toque `updated_at = now()` em todos os três webhooks:
- `supabase/functions/uazapi-chat-webhook/index.ts`
- `supabase/functions/meta-webhook/index.ts`
- `supabase/functions/instagram-webhook/index.ts`

Isso garante a posição correta no topo após a reabertura.

### 3. Memória

Atualizar `mem/features/chat/conversation-reopen-rules.md` com nota:
> A lista do chat só reflete a reabertura em tempo real porque o handler de realtime faz upsert/remove conforme o filtro de status ativo (não apenas map). Não voltar para `prev.map(...)` puro.

## Arquivos editados

- `src/contexts/WhatsAppDataContext.tsx` (handler realtime + ref)
- `supabase/functions/uazapi-chat-webhook/index.ts` (garantir `updated_at`)
- `supabase/functions/meta-webhook/index.ts` (garantir `updated_at`)
- `supabase/functions/instagram-webhook/index.ts` (garantir `updated_at`)
- `mem/features/chat/conversation-reopen-rules.md`

## Validação

1. Resolver conversa do contato X (atribuída ao usuário A).
2. Estando logado como A, na aba "Em aberto", pedir ao contato X que envie nova mensagem.
3. **Esperado**: a conversa aparece no topo da lista "Em aberto", já atribuída a A, sem reload e sem trocar de filtro.
4. Caso oposto: conversa "Em aberto" sendo movida para `resolved` por outro operador → some da lista de A em tempo real.
