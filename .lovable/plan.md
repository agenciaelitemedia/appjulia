# Remover auto-atribuição ao abrir conversa

## Causa

Em `src/contexts/WhatsAppDataContext.tsx`, dentro de `selectContact` (linhas ~2287–2389), existe um helper `autoAssumeIfUnassigned` que é chamado sempre que o usuário clica numa conversa. Se `assigned_to` estiver vazio e o status for `pending`/`open`, ele executa `assignConversation(conv.id, user.name, userId)` — ou seja, "assume" automaticamente em nome de quem clicou. O comentário no código inclusive diz: *"auto-assumes the conversation for whoever opens it (equivalent to clicking Assumir)"*.

É por isso que a conversa em "Aguardando" já sai atribuída assim que é aberta, sem passar pelo botão **Assumir**.

## Mudança proposta

Arquivo: `src/contexts/WhatsAppDataContext.tsx`

1. Remover a definição do helper `autoAssumeIfUnassigned` (linhas ~2334–2359).
2. Remover a chamada `void autoAssumeIfUnassigned(activeConv);` no ramo em que já existe conversa ativa (linha ~2375) — manter apenas a resolução da conversa ativa, sem side-effect de assign.
3. No ramo `getOrCreateConversation(contactId)` (linhas ~2384–2388), remover o `.then((conv) => autoAssumeIfUnassigned(conv))` e deixar apenas o `.catch` de log. A criação/hidratação da conversa continua igual; só não atribui mais.
4. Atualizar o comentário do bloco (linha 2287–2289) para refletir o novo comportamento: apenas seleciona/hidrata a conversa e marca como lida — a atribuição passa a ser explícita via botão **Assumir**.

Nada mais muda:
- `assignConversation` continua igual (usado pelo botão Assumir, transferências, etc.).
- `markAsRead` continua sendo chamado ao clicar.
- Regras de auto-assign por automação (`chat-automation-engine` → `auto_assign`) e roteamento continuam funcionando normalmente — elas não passam por `selectContact`.
- Nenhuma migração de banco é necessária.

## Resultado esperado

Ao clicar numa conversa em "Aguardando atendimento" sem responsável, ela permanece sem responsável (`assigned_to = null`, status `pending`). Só é atribuída quando o usuário clica explicitamente em **Assumir** no header do chat.
