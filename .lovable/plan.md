
# Por que a conversa de 556299057344 não aparece no chat

## Diagnóstico (verificado no banco)

Contato **Dureis / 556299057344** (client_id 30) tem **1 conversa** com status `pending`, protocolo `#2026-019752`, atualizada em `2026-05-09`. Ela está vinculada a esta fila:

- Fila real da conversa: **MRA** (`id 9ddbf116…`) — `is_active=true`, `is_deleted=false`.
- Fila **"Mario MRC"** (`id 03b1b983…`) — `is_active=false`, `is_deleted=true` (soft-deleted).

Ou seja: a conversa **não chegou na MRC**. Ou o roteamento levou para MRA (que talvez tenha sido renomeada/desmembrada de MRC), ou a MRC foi excluída depois. Como o front esconde conversas de filas com `is_deleted=true` (ver `useDealConversation.ts` e `useAgentChatTarget.ts`), nada apareceria mesmo que estivesse lá.

## Perguntas para escolher o caminho

Antes de mexer, preciso confirmar 1 coisa: a **intenção** atual é

- **(A)** a conversa deveria estar na MRA mesmo → basta o usuário ter acesso à fila MRA e olhar em "Pendentes"; ou
- **(B)** MRC deveria continuar existindo → precisamos reativar a fila MRC (`is_deleted=false, is_active=true`) e, se for o caso, mover a conversa de MRA para MRC.

## Ações propostas por caminho

### Caminho A — usar MRA (mais provável)
1. Confirmar em `queue_agent_links` / permissões que o usuário reclamando tem acesso à fila **MRA**.
2. Abrir `/chat`, selecionar fila **MRA**, aba **Pendentes** — a conversa `#2026-019752` deve aparecer.
3. Nenhuma mudança de código ou dados necessária.

### Caminho B — restaurar MRC
1. `UPDATE queues SET is_deleted=false, is_active=true WHERE id='03b1b983-2b1e-476e-8137-0a49337883aa'`.
2. (Opcional) Mover a conversa: `UPDATE chat_conversations SET queue_id='03b1b983…' WHERE id='e611ab57-7466-4115-934a-292e0520b201'` — só se realmente for o esperado.
3. Garantir vínculos em `queue_agent_links` e agente/instância uazapi da MRC.

## Fora do escopo
- Mudar a regra de esconder filas soft-deleted no front (essa é uma proteção intencional).
- Alterar roteamento automático de novas conversas.

Confirma qual caminho seguir (A ou B)?
