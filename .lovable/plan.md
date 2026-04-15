

## Plano: Criar sessão na tabela `sessions` ao iniciar conversa manual

### Problema
A lista de conversas do Atendimento Humano é alimentada pela query `get_inactive_sessions`, que faz `SELECT FROM sessions s JOIN agents a ON a.id = s.agent_id WHERE s.active = false`. Quando uma conversa é iniciada manualmente, não existe registro na tabela `sessions`, então o lead não aparece na lista automaticamente.

### O que será feito

**1. Criar nova action `create_manual_session` no Edge Function `db-query/index.ts`**
- Busca o `agent_id` pelo `cod_agent`
- Insere um registro na tabela `sessions` com:
  - `agent_id` do agente
  - `whatsapp_number` do número informado
  - `active = false` (para aparecer na lista de inativos)
  - timestamps `created_at` e `updated_at` = NOW()
- Usa `ON CONFLICT` (se existir constraint) ou verifica existência antes de inserir para evitar duplicatas

**2. Atualizar `StartConversationDialog.tsx`**
- Após enviar a mensagem e criar o card CRM, chamar a nova action `create_manual_session` via `externalDb.raw()` para inserir a sessão
- Isso garante que o `refetch` do hook `useInactiveLeads` (polling de 30s) trará o novo lead automaticamente

**3. Atualizar `externalDb.ts`**
- Adicionar método `createManualSession(whatsappNumber, codAgent)` que invoca a action

**4. Atualizar `HumanSupportPage.tsx`**
- No callback `handleStartConversation`, chamar `refetch()` imediatamente para forçar a atualização da lista sem esperar os 30s
- Expor `refetch` do hook e passá-lo para o fluxo

### Fluxo final
1. Usuário digita número, nome e mensagem → clica "Enviar"
2. Mensagem é enviada via WhatsApp (UaZapi/WABA)
3. Card CRM é criado/atualizado em `crm_atendimento_cards`
4. Sessão é criada em `sessions` com `active = false`
5. Lista é recarregada via `refetch()` → lead aparece imediatamente
6. Comportamento idêntico a uma conversa que chega via Julia IA

### Arquivos a modificar
- `supabase/functions/db-query/index.ts` — nova action `create_manual_session`
- `src/pages/atendimento-humano/components/StartConversationDialog.tsx` — chamar criação de sessão
- `src/lib/externalDb.ts` — método `createManualSession`
- `src/pages/atendimento-humano/HumanSupportPage.tsx` — passar `refetch` e chamar após sucesso

