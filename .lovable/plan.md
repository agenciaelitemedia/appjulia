## Diagnóstico

Em `/chat`, mensagens aparecem fora de ordem (antigas surgindo logo após novas). Ao recarregar a página, a ordem volta ao normal. Isso indica que a desordem não vem do banco — vem de como o `WhatsAppDataContext` mistura mensagens em memória.

Causa raiz em `src/contexts/WhatsAppDataContext.tsx`:

1. **Realtime INSERT (linha ~2166–2181)** sempre faz `[...existing, enriched]`, empurrando toda mensagem nova para o **fim** do array, sem comparar `timestamp`. Quando chegam mensagens com timestamp anterior ao último item já em memória — cenário típico do **History Backfill on-demand** (mem://features/chat/history-backfill-on-demand), de eventos atrasados, ou de mensagens de outra fila/sessão sendo gravadas em lote — elas vão parar visualmente abaixo de mensagens mais novas.

2. **`loadMessages` offset=0 (linha ~1274–1281)** monta `[...ordered, ...realtimeOnly]`. As mensagens "realtimeOnly" são apenas aquelas que ainda não estavam na página retornada pelo banco, mas são concatenadas no fim sem reordenar por `timestamp` — mesmo problema.

3. **`loadMessages` paginação (linha ~1283–1286)** prepende `newOlder` ao array existente assumindo que todas as novas são mais antigas; se houver overlap por timestamp idêntico ou mensagens já reposicionadas, a ordem global pode ficar inconsistente.

O `ChatMessages.tsx` confia que `messages[contactId]` vem em ordem cronológica ASC para fazer o merge two-pointer com `conversationHistory` — então qualquer desordem upstream se propaga para o timeline renderizado.

## Correção

Garantir que o array `messages[contactId]` esteja sempre **ordenado por `timestamp` ASC** após qualquer mutação, sem custo desnecessário.

### Mudanças em `src/contexts/WhatsAppDataContext.tsx`

1. **Adicionar helper** `insertMessageSorted(list, msg)`:
   - Calcula `ts = new Date(msg.timestamp).getTime()`.
   - Procura, **a partir do fim** (caso comum: mensagem nova é a mais recente), o índice onde inserir.
   - Insere via `splice` em posição correta. O(n) no pior caso, O(1) amortizado no caminho feliz.
   - Tie-breaker estável: se timestamps iguais, usa `created_at` e depois `id`.

2. **Realtime INSERT handler (~linha 2166)**: substituir `[...existing, enriched]` por `insertMessageSorted(existing, enriched)`.

3. **`loadMessages` offset=0 merge (~linha 1281)**: após combinar `ordered + realtimeOnly`, fazer um `sort` único por `timestamp` ASC (com tie-breaker). É barato porque o array tem ≤ ~50 + alguns realtime.

4. **`loadMessages` paginação (~linha 1286)**: idem — após `[...newOlder, ...existing]`, aplicar o mesmo `sort`. Garante consistência mesmo em casos extremos de overlap.

5. **Sender (`sendMessage`/`sendMedia`) e UPDATE handlers**: revisar rapidamente — eles já adicionam mensagens no fim com `timestamp = now()`, o que normalmente está correto, mas vamos rotear pelo mesmo `insertMessageSorted` para uniformidade e robustez (não muda comportamento quando a mensagem é de fato a mais recente).

### Não-objetivos

- Não muda o schema do banco nem o comportamento do `chat-history-backfill`.
- Não muda a UI do `ChatMessages.tsx` — ele continua confiando que a entrada está ordenada.
- Não toca em `conversationHistory` (eventos do timeline), que já vem ordenado do banco.

### Validação

- Abrir uma conversa cujo backfill ainda esteja rodando: as mensagens antigas trazidas pelo backfill agora aparecem **acima** das novas, não no rodapé.
- Receber mensagem nova em tempo real: continua aparecendo no fim e dispara auto-scroll.
- Paginação para cima (carregar mais antigas): mantém posição de scroll e ordem cronológica correta.
- F5 produz a mesma ordem que a sessão acumulada (sem precisar recarregar).
