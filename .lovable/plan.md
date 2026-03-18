

## Plano: Histórico de Conversas do Chat Interativo no Banco

### O que muda

Atualmente o chat do copiloto perde todas as mensagens ao fechar o widget. Vamos persistir o histórico no banco (Supabase) e enviar o contexto completo da conversa para a IA.

### 1. Nova tabela `crm_copilot_chat_messages`

| Coluna | Tipo | Default |
|---|---|---|
| id | uuid | gen_random_uuid() |
| user_id | integer | NOT NULL |
| role | text | NOT NULL ('user' ou 'assistant') |
| content | text | NOT NULL |
| created_at | timestamptz | now() |

RLS: permissiva (mesmo padrão das demais tabelas do copiloto). Índice em `(user_id, created_at)`.

### 2. Frontend — `CopilotChatTab.tsx`

- No `useEffect` inicial, carregar últimas 50 mensagens do banco via `supabase.from('crm_copilot_chat_messages').select().eq('user_id', user.id).order('created_at').limit(50)`
- Após enviar mensagem do usuário, inserir no banco com `role: 'user'`
- Após streaming completo da resposta, inserir no banco com `role: 'assistant'`
- Adicionar botão "Limpar conversa" no header do chat para deletar histórico

### 3. Edge Function — `copilot-chat/index.ts`

- Receber `history` (array de `{role, content}`) além de `message`
- Montar o array de mensagens da IA com: `[system, ...history, {role: 'user', content: message}]`
- Limitar histórico a últimas 20 mensagens para não estourar contexto

### Arquivos

| Arquivo | Ação |
|---|---|
| Migração SQL | Criar tabela `crm_copilot_chat_messages` |
| `src/components/copilot/CopilotChatTab.tsx` | Editar — carregar/salvar mensagens no banco, botão limpar |
| `supabase/functions/copilot-chat/index.ts` | Editar — aceitar `history` e enviar contexto completo à IA |

