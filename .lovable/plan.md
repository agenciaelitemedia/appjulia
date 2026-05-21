## Diagnóstico

Config atual em `client_ai_model_config` para `chat_transcription`:
- provider = `openrouter`, model = `openai/whisper-1`

A edge function `chat-transcribe-audio` chama `POST /v1/chat/completions` com payload `input_audio` — Whisper não é modelo de chat → 5xx → cai no `FALLBACK_MODEL = google/gemini-2.5-pro` (hardcoded). Por isso parece que "está usando Gemini" mesmo com Whisper configurado.

OpenRouter expõe um endpoint dedicado de transcrição: `POST https://openrouter.ai/api/v1/audio/transcriptions` aceitando body JSON com `input_audio.data/format`, `model`, `language`.

## Plano de Correção

### 1. Roteamento por provider em `chat-transcribe-audio/index.ts`

- **provider = `lovable`** → fluxo atual (`/chat/completions` com `input_audio`), modelo **sempre `google/gemini-2.5-flash`** (nunca `pro`).
- **provider = `openrouter`** → chamar:
  ```
  POST https://openrouter.ai/api/v1/audio/transcriptions
  Authorization: Bearer <OPENROUTER_KEY>
  Content-Type: application/json
  body: {
    input_audio: { data: <base64>, format: "ogg"|"mp3"|"wav"|"mp4" },
    model: <model exato vindo de client_ai_model_config>,  // ex.: openai/whisper-1
    language: "pt"   // ISO-639-1 pt-BR
  }
  ```
  Resposta: `data.text` → gravar como `transcription`.
- **Sempre respeitar o modelo configurado** em `/configurações → Modelos de IA` — não substituir nem normalizar (se o usuário escolheu `openai/whisper-1`, manda `openai/whisper-1`; se trocar para `openai/whisper-large-v3`, manda esse).
- **Remover o fallback automático para `gemini-2.5-pro`**. Em falha real do provider escolhido, retornar `{ ok:false, reason:'ai_<status>' }` (HTTP 200 — UI já trata e oferece "Tentar novamente"). Nada de mascarar com outro modelo.
- Continuar logando em `ai_usage_logs` com `provider`, `endpoint`, `model`, `status` reais.

### 2. `_shared/aiGateway.ts`

- Expor constante `OPENROUTER_TRANSCRIBE_ENDPOINT = "https://openrouter.ai/api/v1/audio/transcriptions"`.
- Manter `FEATURE_DEFAULT_MODEL.chat_transcription = 'google/gemini-2.5-flash'` (fallback quando não há config).

### 3. UI `/configurações → Modelos de IA`

Em `src/pages/configuracoes/components/` (cartões por feature) + `useAIModelList`:

- Para **toda feature**, garantir que a lista do dropdown sempre comece com a opção fixa **Lovable AI → `google/gemini-2.5-flash`** marcada como default.
- **Filtrar/remover qualquer modelo Lovable terminado em `-pro`** do dropdown (Flash, Flash-Lite, Flash-Image continuam disponíveis).
- Modelos OpenRouter continuam sendo gerenciados pelo CRUD existente — o usuário adiciona livremente (ex.: `openai/whisper-1`, `openai/whisper-large-v3`, etc.).
- No cartão **Transcrição de Áudio**, exibir hint: "Modelos OpenRouter usam o endpoint `/audio/transcriptions` com `language=pt`. O modelo selecionado aqui é o que será efetivamente chamado."
- Migração leve: garantir que `chat_transcription` permaneça com `provider='openrouter', model='openai/whisper-1'` (config atual do usuário) — nenhuma sobrescrita.

### 4. Logs (`ai_usage_logs`)

Sem mudança de schema. Após o fix, registros refletirão a verdade:
- `provider=openrouter`, `endpoint=…/audio/transcriptions`, `model=openai/whisper-1`, `status=ok|failed`.

## Arquivos a alterar

- `supabase/functions/chat-transcribe-audio/index.ts` — branch por provider + remover fallback Gemini + `language: "pt"`.
- `supabase/functions/_shared/aiGateway.ts` — constante do endpoint de transcrição OpenRouter.
- `src/pages/configuracoes/components/` (cartões de Modelos de IA) — opção Lovable Flash fixa + filtro `*-pro`.

Pronto para implementar — pode confirmar com "ok" / "implementar".
