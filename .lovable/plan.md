## Objetivo

Adicionar configurações por agente em `/admin/agentes/:id/editar` (e propagar para o módulo de chat) que ativem três automações: **Transcrever Áudio**, **Resumo Automático ao Resolver** e **Resumo Automático ao Encerrar** (manual). Criar dois "AI Features" novos (resumo e transcrição) configuráveis em `/configuracoes` → aba **IA's**, com escolha de modelo e edição de prompt. Renderizar transcrições inline na bolha de áudio com UX colapsada.

---

## 1. UI no `ConfigStep` (cadastro/edição de agente)

Arquivo: `src/pages/agents/components/wizard-steps/ConfigStep.tsx`

- Adicionar três campos ao tipo `ConfigFields` e ao `DEFAULT_CONFIG` (todos default `false`):
  - `AUTO_TRANSCRIBE_AUDIO: boolean`
  - `AUTO_SUMMARY_ON_RESOLVE: boolean`
  - `AUTO_SUMMARY_ON_CLOSE: boolean` (encerramento **manual** apenas)
- Inserir um novo `<Card>` logo após o card "Áudio e Ligações" (~linha 253), título **Inteligência de Atendimento** (ícone `Sparkles`/`Brain`), contendo três blocos `Switch` no mesmo padrão visual.
- Helper `updateField` existente já cuida da serialização em `config_json` → `agents.settings`. Sem mudanças no fluxo de save.

## 2. Helper compartilhado de leitura das flags

Arquivo novo: `src/lib/agentSettings.ts`

- `getAgentAutomationFlags(settingsRaw: string | object | null)` → `{ autoTranscribeAudio, autoSummaryOnResolve, autoSummaryOnClose, usingAudio }` com defaults `false`. Parse defensivo.
- Versão Deno equivalente em `supabase/functions/_shared/agentSettings.ts` para uso server-side.

## 3. Novos AI Features configuráveis em `/configuracoes` → IA's

### 3.1 Migração de schema (apenas mudança aditiva)

- Alterar `client_ai_model_config`:
  - Adicionar coluna `prompt text NULL` (mantém upsert por `(client_id, feature)`).
- Inserir/permitir duas novas features no enum aplicacional (a coluna `feature` é `text`, nenhuma alteração de schema necessária além do prompt):
  - `chat_resume` — usado por resumo automático ao resolver/encerrar e por resumo manual.
  - `chat_transcription` — usado pela transcrição automática e manual de áudios.

### 3.2 `useAIModelsConfig` (`src/hooks/useAIModelsConfig.ts`)

- Expandir `AIFeature` para `'chat_assist' | 'copilot_crm' | 'copilot_chat' | 'chat_resume' | 'chat_transcription'`.
- Estender `DEFAULT_MODELS` (defaults `google/gemini-2.5-flash`).
- Novo `DEFAULT_PROMPTS: Record<AIFeature, string>` com os prompts iniciais (ver 3.4).
- Adicionar `getPrompt(feature)` retornando `configs.find(...)?.prompt ?? DEFAULT_PROMPTS[feature]`.
- Estender mutation: `upsertModel` aceita `{ feature, model?, prompt? }` (faz upsert parcial sem zerar o outro campo).

### 3.3 `AIModelsConfig.tsx` (`src/pages/configuracoes/components/AIModelsConfig.tsx`)

- Adicionar dois novos `FeatureCard`:
  - **Resumo de Conversa** (`chat_resume`), ícone `FileText`.
  - **Transcrição de Áudio** (`chat_transcription`), ícone `AudioLines`.
- Em cada `FeatureCard`, adicionar botão de ícone (`Pencil`/`Eye`) ao lado do `<Select>` que abre um `<Dialog>` "Editar Prompt":
  - `Textarea` grande com o prompt atual (ou `DEFAULT_PROMPTS[feature]`).
  - Botões **Restaurar padrão** e **Salvar**.
  - Salvar dispara `upsertModel.mutateAsync({ feature, prompt })`.

### 3.4 Prompts padrão

- `**chat_resume` (resumo objetivo, focado no cliente):**
  > Você é um analista de atendimento. Gere um RESUMO OBJETIVO em português da conversa abaixo, priorizando os RELATOS DO CLIENTE (situação, dores, pedidos, dados pessoais relevantes ao caso). Mencione respostas do atendente APENAS quando forem indispensáveis para entender o caso (ex.: instrução crítica, compromisso assumido, encaminhamento). Use os resumos anteriores fornecidos como CONTEXTO acumulado; não os repita, apenas incorpore o que ainda for relevante. Saída em até 6 bullets curtos. Comece com 1 frase em negrito identificando o caso. Não invente informações.
- `**chat_transcription`:**
  > Você é um transcritor profissional em português (pt-BR). Transcreva o áudio com fidelidade, sem traduzir, sem resumir e sem comentários. Mantenha hesitações apenas se forem semanticamente relevantes. Retorne somente o texto transcrito.

## 4. Resumo automático (manual em Resolver/Encerrar)

### 4.1 Regra confirmada

- Encerramento em LOTE (`chat-bulk-close`) **NÃO gera resumo**.
- Resumo automático é disparado apenas em:
  - Clique em **Resolver** (manual) com `AUTO_SUMMARY_ON_RESOLVE=true`.
  - Clique em **Encerrar** (manual) com `AUTO_SUMMARY_ON_CLOSE=true`.

### 4.2 Janela do resumo (regra fixa)

- Buscar em `chat_conversation_summaries` o último resumo da conversa (ordenado por `last_message_ts DESC`).
- Se existir: novas mensagens = `timestamp > lastSummary.last_message_ts`, limitadas às últimas **100** mensagens.
- Se não existir: usar as últimas **100** mensagens da conversa.
- Carregar os últimos **N=10** resumos anteriores como **contexto acumulado** (apenas `summary` + intervalo de datas) e enviar ao modelo como bloco "RESUMOS ANTERIORES".
- Persistir o registro novo em `chat_conversation_summaries` com:
  - `first_message_ts` (data/hora da 1ª mensagem da janela usada agora).
  - `last_message_ts` (data/hora da última mensagem usada agora).
  - `message_count`, `triggered_by` (`'auto_resolve' | 'auto_close' | 'manual'`).

### 4.3 Edge function `chat-ai-assist`

Arquivo: `supabase/functions/chat-ai-assist/index.ts`

- Acrescentar modo `**incremental_summary**`:
  - Body: `{ conversation_id, client_id, mode: 'incremental_summary' }`.
  - Service-role busca `chat_conversation_summaries` (últimos resumos) e `chat_messages` (janela conforme 4.2).
  - Resolve modelo via `getModel(client_id, 'chat_resume')` e prompt via nova função `getPrompt(client_id, 'chat_resume')` (helper a adicionar no edge: consulta `client_ai_model_config.prompt`, com fallback para um literal default igual ao 3.4).
  - Monta `messages = [{role:'system', content: prompt}, {role:'user', content: <RESUMOS ANTERIORES>\n\n<TRANSCRIÇÃO ATUAL com transcrições de áudio inseridas no lugar das mensagens de áudio>}]`.
  - **IMPORTANTE:** ao montar a transcrição, se `chat_messages.metadata.transcription` existir, substituir o placeholder do áudio por `[Áudio transcrito: "..."]`. Sem transcrição, usa `[Áudio sem transcrição]`.
  - Retorna `{ summary, sentiment?, atendimento?, first_message_ts, last_message_ts, message_count }`.
- Mantém modos existentes (`summary`, `suggest`, `sentiment`, `full_summary`) intactos.

### 4.4 Hook compartilhado e gravação da nota

Arquivo novo: `src/hooks/useAutoSummaryOnStatusChange.ts`

- Função `triggerAutoSummary({ conversationId, contactId, trigger: 'auto_resolve' | 'auto_close' })`:
  1. Lê o agente vinculado (via `cod_agent` do contato/conversa) e checa flag correspondente. Se desligada, no-op.
  2. Chama `supabase.functions.invoke('chat-ai-assist', { body: { conversation_id, client_id, mode: 'incremental_summary' } })`.
  3. Insere em `chat_conversation_summaries` (mesma estrutura usada por `useConversationSummaries`).
  4. Insere uma **nota interna** em `chat_messages`:
    - `internal_note = true`, `metadata.note_type = 'info'`, `metadata.kind = 'auto_summary'`, `metadata.triggered_by = trigger`.
    - `text` = `**Resumo automático (Resolvida|Encerrada) — ${dataHora}**\n\n${summary}`.
    - `conversation_id`, `contact_id`, `client_id`, `type='text'`, `from_me=false`, `status='sent'`, `timestamp=now()`.
  5. Toast neutro de sucesso/erro; falha NÃO desfaz o resolve/close (best-effort).
- Toda a chamada é assíncrona/post-status; em caso de erro apenas registra `console.warn`.

### 4.5 Disparo na UI

Arquivo: `src/components/chat/ChatHeader.tsx`

- Após cada `updateConversationStatus(id, 'resolved')` (linhas ~331 e ~388) → chamar `triggerAutoSummary({..., trigger:'auto_resolve'})`.
- Após `updateConversationStatus(id, 'closed')` (botão "Encerrar conversa", ~linha 603) → chamar `triggerAutoSummary({..., trigger:'auto_close'})`.
- Bulk close (`BulkCloseConversationsCard`) permanece sem resumo (regra confirmada).

## 5. Transcrição automática de áudios

### 5.1 Critérios

- Aplica-se a mensagens `type IN ('audio','ptt')`, tanto `from_me=false` (cliente) quanto `from_me=true` (atendente).
- Somente se o agente vinculado tiver `AUTO_TRANSCRIBE_AUDIO=true` E (`USING_AUDIO=true` para áudios recebidos).

### 5.2 Edge function nova: `supabase/functions/chat-transcribe-audio/index.ts`

- Body: `{ message_id, client_id?, force?: boolean }`.
- Resolve `chat_messages` → obtém `media_url` (ou `metadata.media_url`) e `cod_agent` do contato.
- Se `metadata.transcription` já existe e `!force` → retorna existente.
- Faz `POST /message/download` no UaZapi (padrão "Media Decrypt" da memória) quando o arquivo for `.enc`. Resultado: `audio/ogg|mpeg|wav` base64/URL.
- Chama Lovable AI Gateway no modo multimodal de áudio:
  - Modelo via `getModel(client_id, 'chat_transcription')` (default `google/gemini-2.5-flash`).
  - System prompt via `getPrompt(client_id, 'chat_transcription')`.
  - Envia o áudio como `input_audio` (formato suportado pelo provider) + instrução do prompt.
- Salva resultado em `chat_messages.metadata.transcription = { text, generated_at, model, source: 'auto'|'manual' }`. Atualiza `updated_at` da mensagem.
- Retorna `{ transcription, model }`. Tratamento de 429/402 explícito.
- `verify_jwt = true` (chamadas vêm do client autenticado) — exceto quando invocada por outro edge function (server-side) que use service-role.

### 5.3 Gatilho automático

- Em `supabase/functions/uazapi-chat-webhook/index.ts`, `meta-webhook/index.ts` e `instagram-webhook/index.ts`: após persistir uma mensagem de áudio, se a flag estiver ativa, usar `EdgeRuntime.waitUntil(fetch(... /chat-transcribe-audio))` (fire-and-forget). Falha apenas loga.
- Helper compartilhado em `_shared/agentSettings.ts` faz a leitura.

### 5.4 UI da bolha de áudio (capricho)

Arquivo: `src/components/chat/messages/AudioMessage.tsx` (ou equivalente já existente; localizar via grep `type === 'audio'` e `MessageBubble`).

Estados visuais:

- **Sem flag ativa para o client** → não exibir nada além do player.
- **Com flag ativa, sem transcrição** → mostrar abaixo do player um pequeno link/botão `text-xs` `flex items-center gap-1` ícone `Sparkles`:
  - `[Sparkles] Gerar transcrição` → ao clicar, chama `chat-transcribe-audio` (mode manual), exibe spinner inline, ao terminar revalida React Query e renderiza transcrição.
- **Com transcrição disponível** → exibir caixa compacta com fundo `bg-muted/40`, `rounded-md`, `px-3 py-2`, `text-sm leading-relaxed`:
  - Cabeçalho: ícone `AudioLines` + label `Transcrição` (`text-xs text-muted-foreground uppercase tracking-wide`).
  - Corpo: 2 primeiras linhas visíveis (`line-clamp-2`).
  - Link inferior: `Ver transcrição` (toggle) — ao clicar expande para texto completo (`line-clamp-none`), label muda para `Recolher`. Animação `transition-all duration-200`.
  - Quando expandido, mostrar metadados sutis: data/hora da geração e `Gerada automaticamente` ou `Gerada manualmente`.
- Componente isolado: `src/components/chat/messages/TranscriptionBlock.tsx`, com props `{ transcription?: {text, generated_at, source}, canGenerate: boolean, onGenerate: () => Promise<void> }`. Renderizado pelo `MessageBubble` quando `type === 'audio' || type === 'ptt'`.
- `canGenerate` vem de hook novo `useClientHasAudioTranscription()` que retorna `true` se o agente vinculado ao contato/conversa tem `AUTO_TRANSCRIBE_AUDIO=true`. Como o agente pode variar por conversa, esse hook recebe `cod_agent`.

### 5.5 Uso das transcrições no resumo

- O modo `incremental_summary` (4.3) já consulta `metadata.transcription.text` ao montar a transcrição para o LLM, garantindo que áudios — tanto do cliente quanto do atendente — entrem no contexto do resumo.

## 6. Memória

- Atualizar `mem://index.md` adicionando:
  - `[Agent Automation Flags](mem://features/agents/automation-flags)` — chaves no JSON `agents.settings`.
  - `[Chat Transcription UI](mem://ui/patterns/audio-transcription-block)` — padrão visual da caixa de transcrição.
  - `[AI Features Prompts](mem://features/admin/ai-features-prompt-editor)` — schema `client_ai_model_config.prompt` e features novas.

## 7. Garantias de não-regressão

- Defaults `false` em todas as três flags → agentes existentes não mudam comportamento.
- Resumo e transcrição são fire-and-forget: erro NUNCA bloqueia resolve/close ou recebimento de mensagem.
- `chat-bulk-close` permanece inalterado (sem resumo).
- Migração apenas adiciona coluna `prompt`. Linhas existentes ficam `NULL` → função usa default literal.
- Falhas de IA retornam 429/402 explicitamente e são mostradas via toast.

## 8. Arquivos a criar/editar

**Criar:**

- `src/lib/agentSettings.ts`
- `src/hooks/useAutoSummaryOnStatusChange.ts`
- `src/hooks/useClientHasAudioTranscription.ts`
- `src/components/chat/messages/TranscriptionBlock.tsx`
- `supabase/functions/chat-transcribe-audio/index.ts`
- `supabase/functions/_shared/agentSettings.ts`
- migração SQL: `ALTER TABLE public.client_ai_model_config ADD COLUMN IF NOT EXISTS prompt text NULL;`

**Editar:**

- `src/pages/agents/components/wizard-steps/ConfigStep.tsx` (novo card)
- `src/hooks/useAIModelsConfig.ts` (features `chat_resume`, `chat_transcription`, `prompt`)
- `src/pages/configuracoes/components/AIModelsConfig.tsx` (2 novos cards + diálogo de prompt)
- `src/components/chat/ChatHeader.tsx` (chamada do hook após resolve/close)
- `src/components/chat/messages/...` (renderizar `TranscriptionBlock` em áudios)
- `supabase/functions/chat-ai-assist/index.ts` (modo `incremental_summary` + `getPrompt`)
- `supabase/functions/uazapi-chat-webhook/index.ts`, `meta-webhook/index.ts`, `instagram-webhook/index.ts` (gatilho de transcrição)
- `mem://index.md` + 3 novos arquivos de memória