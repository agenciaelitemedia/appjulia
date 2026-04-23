

# Botão "Resetar Chat" em Configurações

## Objetivo

Adicionar na página `/configuracoes` um botão administrativo que permita limpar/resetar todas as tabelas relacionadas a chat e sincronização — escolhendo entre um `client_id` específico (selecionado em popup com a lista de clientes que têm filas) ou **todos** os clientes.

## Localização na UI

Aba **"Provedores de Fila"** em `ConfiguracoesPage.tsx`, ao lado do botão "Novo Provedor", um botão `destructive` com ícone `Trash2` rotulado **"Resetar Chat"**.

## Fluxo de Interação

1. Usuário clica em **"Resetar Chat"** → abre `Dialog`.
2. Dialog mostra:
   - `Select` com opção **"Todos os clientes"** + lista dinâmica `client_id — nome` (clientes que têm pelo menos uma fila ativa em `queues`).
   - `Checkbox` opcional: **"Incluir histórico de sincronização"** (tabelas `chat_sync_*`).
   - Texto de aviso vermelho explicando irreversibilidade.
   - Campo de confirmação: usuário deve digitar `RESETAR` (padrão de dupla confirmação do projeto).
3. Botão **"Confirmar Reset"** habilita só quando texto = `RESETAR`.
4. Ao confirmar → invoca edge function `chat-reset` → toast com contagem de linhas removidas por tabela.

## Componentes a Criar

**`src/pages/configuracoes/components/ResetChatDialog.tsx`** (novo)
- Dialog com `Select` de clientes (carrega via `supabase.functions.invoke('chat-reset', { body: { action: 'list_clients' } })`).
- Estado: `selectedClientId` (`'all' | string`), `includeSync` (boolean), `confirmText` (string).
- Botão de confirmação chama `chat-reset` com `action: 'reset'`.

**`src/pages/configuracoes/ConfiguracoesPage.tsx`** (editar)
- Importa `ResetChatDialog` e adiciona o botão `destructive` no header da aba "Provedores de Fila".

## Edge Function a Criar

**`supabase/functions/chat-reset/index.ts`** (nova)

Ações suportadas:

- **`list_clients`** → retorna `[{ client_id, name, queues_count }]` consultando `queues` agrupado por `client_id` (join opcional com `users`/`vw_equipe` para obter nome).
- **`reset`** → executa `DELETE` parametrizado com `client_id` (ou sem filtro se `'all'`).

Tabelas afetadas (mesmo conjunto já usado nas migrations recentes):

```text
chat_message_reactions
chat_mentions
chat_ai_classifications
chat_ai_autoreply_logs
chat_automation_logs
chat_csat_responses
chat_conversation_history
chat_conversation_tags
chat_conversation_participants
chat_conversation_presence
chat_conversation_summaries
chat_messages
chat_conversations
chat_contacts
```

Quando `includeSync = true`, também limpa:
```text
chat_sync_jobs
chat_sync_history
chat_sync_logs
```
(as tabelas exatas serão confirmadas inspecionando o schema antes do delete; se uma tabela não existir, é ignorada com `try/catch`).

**Lógica de filtro por `client_id`:**
- Tabelas com coluna `client_id`: `DELETE WHERE client_id = $1`.
- Tabelas filhas sem `client_id` direto (ex: `chat_messages`): `DELETE WHERE conversation_id IN (SELECT id FROM chat_conversations WHERE client_id = $1)`.
- Quando `'all'`: usa `TRUNCATE ... RESTART IDENTITY CASCADE` (mais rápido).

**Segurança:**
- `verify_jwt = false` (padrão Lovable), mas valida no código que o usuário tem `role` administrativa via header `Authorization` + lookup em `users`.
- CORS habilitado.
- Validação Zod do body.

Retorna JSON: `{ success: true, deleted: { chat_messages: 1234, chat_conversations: 56, ... } }`.

## Detalhes Técnicos

- Conexão DB: usa `postgresjs` com normalização SSL CA, padrão das demais edge functions externas.
- A função é registrada automaticamente em `supabase/config.toml` (sem alterações manuais necessárias).
- Após sucesso no frontend: `queryClient.invalidateQueries({ queryKey: ['chat-conversations'] })` e similares para refletir o reset em telas abertas.

## Validação

1. Abrir `/configuracoes` → aba "Provedores de Fila" → clicar "Resetar Chat".
2. Conferir que o popup lista apenas clientes com filas (consulta `queues` distinct).
3. Selecionar `client_id = 30` → digitar `RESETAR` → confirmar → verificar via `select count(*) from chat_conversations where client_id = '30'` (deve retornar 0).
4. Selecionar **"Todos"** + **"Incluir sincronização"** → confirmar → todas as tabelas zeradas.
5. Outros `client_id` não afetados quando o reset é específico.

