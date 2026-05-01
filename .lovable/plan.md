
## Diagnóstico do lead 5548988170905 (Ana carolina Trilha)

Confirmei no banco:
- `contact_id`: `06083c26-9377-4238-b8d3-bd89f7937f62`
- `conversation_id`: `d151578c-261e-4e60-b6e5-72a08e124a87`
- `assigned_to`: **Ana Luiza** (tem responsável)
- `status`: **`pending`**
- `first_response_at`: **`NULL`** (atendente nunca enviou mensagem)
- `queue_id`: `ec46239f-...`, criada em 25/04, última atualização 30/04

### Por que está em "Em Abertos" e não em "Em Atendimento"

Hoje as abas no `/chat` são definidas **apenas pelo campo `status`** da `chat_conversations`:
- `Em Abertos` = `status = 'pending'`
- `Em Atendimento` = `status = 'open'`

E o status só muda de `pending → open` em **um único ponto** do código (`WhatsAppDataContext.tsx` linha 1067-1075): quando o atendente **envia a primeira mensagem**, o sistema seta `first_response_at = now()` e `status = 'open'`.

Atribuir um responsável (`assigned_to`) **não altera o status**. Por isso o lead da Ana Luiza, que foi designado mas ainda não respondido, continua em `pending` há 5 dias.

A regra atual ignora a sua expectativa: "todo lead com responsável deve estar em Em Atendimento".

---

## Proposta de correção

Mudar a regra para: **conversa entra em "Em Atendimento" quando tem responsável OU quando já houve primeira resposta**.

### Mudanças

**1. Backend — atualizar status ao atribuir responsável**
Sempre que `assigned_to` for definido (de `NULL` para um valor) em `chat_conversations` com `status = 'pending'`, promover automaticamente para `status = 'open'`.

Implementação: trigger `BEFORE UPDATE` em `chat_conversations`:
```sql
IF NEW.assigned_to IS NOT NULL
   AND (OLD.assigned_to IS NULL OR OLD.assigned_to = '')
   AND NEW.status = 'pending'
THEN
  NEW.status := 'open';
END IF;
```
Mais um backfill único para reclassificar conversas já atribuídas e ainda `pending` (caso da Ana Luiza).

**2. Frontend — refletir a nova semântica nos contadores**
Em `src/components/chat/ChatList.tsx` (linhas ~456-548) e `src/contexts/WhatsAppDataContext.tsx` (linhas ~450-455), os contadores `pendingConvCount` / `openConvCount` hoje lêem direto de `conv.status`. Após o trigger, isso já funciona sozinho, mas como camada de segurança (caso o realtime atrase), também classificar no cliente:
- `Em Atendimento` se `status === 'open' || (status === 'pending' && assigned_to)`
- `Em Abertos` apenas se `status === 'pending' && !assigned_to`

Essa lógica vale para: o filtro da lista (linha 1606), os contadores das abas, e o lookup `selectedConversation` (linha 1582).

**3. Pontos de atribuição cobertos**
A atualização de `assigned_to` acontece em vários fluxos (atribuição manual via UI, roteamento automático em `chat-route-conversation`, sincronização CRM ↔ chat via trigger `sync_deal_to_conversation`). O trigger no banco cobre todos automaticamente, sem precisar tocar em cada caller.

### Arquivos a editar
- nova migration SQL (trigger + backfill)
- `src/contexts/WhatsAppDataContext.tsx` (classificação no cliente)
- `src/components/chat/ChatList.tsx` (contadores + filtro da lista)

### Resultado esperado
- Lead 5548988170905 (Ana Luiza) passa imediatamente para a aba **Em Atendimento**.
- Toda conversa futura, ao receber responsável, sai de "Em Abertos" e entra em "Em Atendimento" — mesmo antes da primeira resposta.
- Conversas sem responsável continuam em "Em Abertos".

Aprova para eu implementar?
