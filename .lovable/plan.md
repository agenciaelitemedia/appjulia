

## Diagnóstico

### Bug 1: Fila e time não aparecem na lista
**Causa raiz** — `WhatsAppDataContext.tsx` linha 1178-1187:
```ts
useEffect(() => {
  if (currentQueueId && clientId) {
    loadContacts();
    loadConversations();
    ...
  }
}, [currentQueueId, ...]);
```
Quando o usuário escolhe **"Todas as filas"** (`selectedQueue=null` → `currentQueueId=undefined`), o efeito **não executa** → `conversations` permanece `[]` → `ChatList.tsx` não acha `conv` para nenhum contato → `queueName` fica `undefined` → badge azul some. O badge cinza "NÃO ATRIBUÍDO" aparece como fallback porque o componente sempre renderiza algo para o time.

**Confirmado no banco:** as conversas TÊM `queue_id` setado (Leonardo, Tell, Sámia, Grupo AM apontam para fila "Agente Principal" ativa). O problema é puramente o efeito de carregamento.

### Bug 2: Mensagens de grupos não chegam
**Causa raiz** — `uazapi-chat-webhook/index.ts` linha 156-163:
```ts
const isGroup = String(chatId).includes('@g.us') || msg.isGroup || ...;
if (isGroup) { skipped.group++; continue; }
```
Toda mensagem de grupo é **descartada** antes do upsert. Banco confirma: `0 grupos, 14 individuais`. Aba "Grupos" fica vazia. O contato "Grupo AM - Advogados Associados" no print é, na verdade, um contato individual cujo nome contém "Grupo" (`remote_jid: ...@s.whatsapp.net`).

**Bonus encontrado:** existe um contato duplicado "Grupo AM" com phone `246600177864794` (LID que vazou antes do fix anterior) — limpar.

---

## Correção

### A. `src/contexts/WhatsAppDataContext.tsx`
1. **Sempre carregar contatos e conversas**, independente de fila selecionada. Trocar a condição do efeito para apenas `clientId`:
   ```ts
   useEffect(() => {
     if (clientId) { loadContacts(); loadConversations(); loadTags(); ... }
   }, [currentQueueId, clientId, ...]);
   ```
2. Garantir que `loadConversations` retorne todas as conversas do cliente quando `currentQueueId` for `null` (já está OK — só falta rodar).

### B. `supabase/functions/uazapi-chat-webhook/index.ts`
1. **Aceitar mensagens de grupo**:
   - Detectar grupo via `chatId.includes('@g.us')` ou `msg.isGroup`/`msg.groupName`.
   - Para grupos: usar `chatid` (ex.: `1203...@g.us`) como identificador único do contato (campo `phone` recebe o ID limpo do grupo, sem `@g.us`).
   - Marcar `is_group: true` no upsert.
   - Nome do contato: `groupName` / `wa_groupName` (cair pra "Grupo {id curto}" se ausente).
   - **Não criar conversa** automaticamente para grupos `pending` (opcional, mas mantém sanidade) — OU criar com tag especial. Vou criar normalmente para que apareçam no chat.
   - **Em mensagens de grupo, `pushName` representa o autor da mensagem dentro do grupo** (ex.: "João disse..."), gravar em `sender_name` da mensagem mas **nunca** sobrescrever `name` do contato grupo.
2. Ampliar a checagem de "phone válido" para grupos: aceitar IDs de grupo (formato `digits-digits` ou só dígitos longos quando vem de `@g.us`).
3. Manter validação rigorosa para LIDs em mensagens individuais.

### C. Limpeza de dados
- Apagar contato duplicado `phone='246600177864794'` (LID residual).

### Validação
1. Recarregar `/chat` com filtro "Todas as filas" → badges azuis de fila + cinza de time/não-atribuído aparecem em cada item.
2. Receber mensagem em grupo WhatsApp monitorado → contato aparece na aba "Grupos" com `is_group=true`, mensagens aparecem no chat.
3. Mensagens individuais continuam funcionando normalmente.
4. Aba "Individual" não mostra grupos; aba "Grupos" mostra apenas grupos.

### Arquivos a editar
- `src/contexts/WhatsAppDataContext.tsx` — remover dependência de `currentQueueId` no efeito de load inicial.
- `supabase/functions/uazapi-chat-webhook/index.ts` — habilitar processamento de grupos com flag `is_group`.
- Migration de limpeza para o contato LID duplicado.

