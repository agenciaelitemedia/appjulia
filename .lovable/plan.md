## Objetivo

Migrar as flags `AUTO_TRANSCRIBE_AUDIO`, `AUTO_SUMMARY_ON_RESOLVE` e `AUTO_SUMMARY_ON_CLOSE` de **por agente** (`agents.settings`) para **por client_id** (`chat_client_settings.settings`), e expor uma nova aba **"Inteligência de Atendimento"** em `/admin/chat`.

## Mudanças

### 1. Frontend — remover do wizard do agente
- `src/pages/agents/components/wizard-steps/ConfigStep.tsx`: remover a seção "Inteligência de Atendimento" (Switches dos 3 flags) e os campos correspondentes da interface/estado local. Manter `USING_AUDIO` (pré-existente, escopo diferente).

### 2. Frontend — nova aba em `/admin/chat`
- `src/pages/admin/chat/ChatAdminPage.tsx`: adicionar nova `TabsTrigger` "Inteligência de Atendimento" (ícone `Brain` ou `Sparkles`) entre "Chat" e "Planos".
- Novo componente `src/pages/admin/chat/components/InteligenciaAtendimentoTab.tsx`:
  - 3 switches (transcrição automática, resumo ao resolver, resumo ao encerrar) com descrições.
  - Usa `useChatClientSettings()` já existente (lê/escreve em `chat_client_settings.settings` JSONB).
  - Chaves persistidas: `auto_transcribe_audio`, `auto_summary_on_resolve`, `auto_summary_on_close` (snake_case, padrão da tabela). Defaults = `false`.

### 3. Hook `useChatClientSettings`
- Adicionar os 3 novos campos booleanos à interface `ChatClientSettings` e aos DEFAULTS, lendo/gravando do JSONB já existente. Mantém compatibilidade com `return_chat_*`.

### 4. Hook `useClientAutomationFlags` (frontend)
- Trocar a fonte: em vez de chamar a edge function `client-automation-flags` (que lê `agents.settings`), ler direto de `chat_client_settings.settings` via supabase client. Mantém a mesma API de retorno (`AgentAutomationFlags`) para não quebrar `ContactDetailPanel.tsx`.

### 5. Backend — `_shared/agentSettings.ts`
- Refatorar `fetchClientAutomationFlags(clientId)`: consultar `chat_client_settings` (Supabase nativa, via `SUPABASE_URL` + service role REST `/rest/v1/chat_client_settings?client_id=eq.X&select=settings`) em vez de `db-query` → `agents`. Cache 60s mantido. Lê chaves snake_case (`auto_transcribe_audio`, `auto_summary_on_resolve`, `auto_summary_on_close`, `using_audio`) com fallback para as antigas UPPER_SNAKE (transição). `usingAudio` continua disponível.
- `fetchAgentFlagsByCod` torna-se obsoleto para essas 3 flags — manter apenas se `USING_AUDIO` ainda for usado por agente (verificar usos; provavelmente sim para áudio do agente). Não remover.

### 6. Backend — consumidores (sem mudança de assinatura)
- `supabase/functions/chat-ai-assist/index.ts`: já chama `fetchClientAutomationFlags` via `chat_conversations.client_id` → continua funcionando, agora lendo da nova fonte.
- `supabase/functions/uazapi-chat-webhook/index.ts`: já chama `fetchClientAutomationFlags(queue.client_id)` para auto-transcribe → idem.
- `supabase/functions/client-automation-flags/index.ts`: continua existindo, mas agora retorna dados de `chat_client_settings`. (Opcional: o frontend pode deixar de usá-la — vamos manter para não exigir mudanças no `useClientAutomationFlags`; basta refatorar o resolver compartilhado.)

### 7. Memória do projeto
- Atualizar `mem/features/agents/automation-flags.md` documentando: flags agora vivem em `chat_client_settings.settings` por client_id; UI em `/admin/chat` → aba "Inteligência de Atendimento"; removidas do wizard de agente; consumidores (`chat-ai-assist`, `uazapi-chat-webhook`, `ContactDetailPanel`) continuam funcionando via o mesmo resolver.

## Migração de dados
Nenhuma — flags antigas em `agents.settings` simplesmente ficam ignoradas (fallback para `false`). O admin precisa reativar uma vez por client_id na nova UI. Não vamos copiar automaticamente para evitar OR-merge surpresa entre múltiplos agentes.

## Não fazer
- Não tocar em `USING_AUDIO` (escopo do agente, fora do pedido).
- Não criar migration nova (a tabela `chat_client_settings` já existe e é JSONB).
- Não mudar contratos das edge functions consumidoras.