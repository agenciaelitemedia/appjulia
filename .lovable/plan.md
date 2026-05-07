## Causa raiz

O hook `src/hooks/useChatClientSettings.ts` (e o `src/hooks/useChatSlaConfigs.ts`) salva e lê as configurações usando `user.id` como `client_id`, em vez do `user.client_id` real do usuário autenticado.

No caso do Mario:
- `user.id = 2` (id da linha do usuário)
- `user.client_id = 30` (cliente ao qual ele pertence)

Quando ele abre `/chat/configuracoes` → aba Geral e ativa "Devolver conversa automaticamente", o registro é gravado em `chat_client_settings` com `client_id = '2'`. Confirmado no banco:

- `client_id='2'` → `return_chat_enabled: true, return_chat_tolerance_minutes: 1`
- `client_id='30'` → não tem `return_chat_enabled` nem tolerância

A RPC `get_return_chat_candidates` faz `JOIN chat_client_settings cs ON cs.client_id = c.client_id` (e `c.client_id = '30'` para as conversas do Mario). Como não há linha com `return_chat_enabled=true` para o client `30`, nenhuma conversa é devolvida — daí o "0 processadas".

O mesmo bug existe em `useChatSlaConfigs` (SLA de NRT salvo no `client_id` errado), o que também afeta o cálculo de tempo do worker.

## Correções

1. **`src/hooks/useChatClientSettings.ts`**
   - Trocar `const clientId = String(user?.id ?? '')` por `const clientId = String(user?.client_id ?? user?.id ?? '')`.
   - Manter o fallback para `user.id` apenas para usuários que são o próprio cliente (sem `client_id`).

2. **`src/hooks/useChatSlaConfigs.ts`**
   - Mesma correção: usar `user.client_id` como `clientId`.

3. **Migração de dados (insert tool, UPDATE)**
   - Mover/mesclar a configuração que ficou em `chat_client_settings.client_id='2'` para `client_id='30'` (preservando os outros campos atuais do `30`):
     - definir `settings.return_chat_enabled = true`
     - definir `settings.return_chat_tolerance_minutes = 1`
   - Não apagar a linha `2` automaticamente; só atualizar a `30` para o usuário voltar a ver os valores corretos.
   - Verificar também `chat_sla_configs` — se houver linhas com `client_id='2'` que deveriam ser `'30'`, mover/mesclar (sem duplicar prioridade existente).

4. **Validação**
   - Após o deploy, abrir `/chat/configuracoes` como Mario: a tela deve mostrar "Devolver conversa = ativado, tolerância = 1 min".
   - Clicar **Executar agora** no Monitor: a conversa parada há > NRT+tolerância deve ser devolvida (status `pending`, `assigned_to=null`, nota interna inserida e linha em `chat_conversation_history` com `action='auto_returned'`).

## Observações

- `ChatReturnChatMonitor` já usa `user?.client_id` corretamente, então o histórico aparecerá assim que o worker processar.
- A RPC e a edge function `chat-return-chat` estão corretas e não precisam mudar.
- Importante revisar se outras telas que dependem desses hooks ainda funcionam para usuários "donos" (que não têm `client_id` próprio, apenas `user.id`); por isso o fallback `user.client_id ?? user.id`.