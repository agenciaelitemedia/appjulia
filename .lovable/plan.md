# Contabilizar uso e custo da IA em todos os agentes

## Contexto

Hoje só `chat-transcribe-audio` registra em `ai_usage_logs`. Demais agentes que chamam IA (assist, autoreply, copiloto, geração de prompt, transcrição do suporte) não persistem nada. Além disso, os retornos OpenRouter/OpenAI já trazem `usage.cost` (USD) e, para transcrição, `usage.seconds` (duração do áudio) — que não estamos capturando.

```json
"usage": { "cost": 0.000508, "input_tokens": 83, "output_tokens": 30, "seconds": 9.2, "total_tokens": 113 }
```

Objetivo: padronizar o log de uso em **todas** as edge functions de IA e expor custo total, minutos transcritos e custo/minuto no Dashboard.

## Mudanças

### 1. Banco — `ai_usage_logs`
Migration adicionando colunas:
- `cost_usd numeric(12,6)` — custo informado pelo provider
- `audio_seconds numeric(10,2)` — duração do áudio (apenas transcrição)

### 2. Helper compartilhado `_shared/aiUsageLogger.ts` (novo)
Centraliza o insert em `ai_usage_logs` para evitar duplicação. Função `logAIUsage(supabase, { client_id, user_id, feature, provider, endpoint, model, status, duration_ms, usage, error_reason, context, audio_seconds })` que:
- Extrai `prompt_tokens` (com fallback para `input_tokens`), `completion_tokens` (fallback `output_tokens`), `total_tokens`.
- Extrai `cost_usd = usage?.cost ?? null`.
- Extrai `audio_seconds = audio_seconds ?? usage?.seconds ?? null`.
- Faz o insert em background com try/catch silencioso.

### 3. Edge functions — instrumentação
Para cada uma, medir `Date.now()` antes/depois da chamada e chamar `logAIUsage` no sucesso e na falha:

- `chat-transcribe-audio` → migrar `logUsage` local para o helper, passar `audio_seconds` do `/message/download` + fallback `usage.seconds`. Feature: `chat_transcription`.
- `support-transcribe-audio` → adicionar log (hoje não tem). Features: `support_transcription` (áudio) e `support_image_describe` (imagem, sem `audio_seconds`).
- `chat-ai-assist` → feature `chat_assist`.
- `chat-ai-process` → identificar a feature do payload (`chat_autoreply`, `chat_resume`, etc.) e logar com o nome correto; se não houver, usar `chat_process`.
- `copilot-chat` → feature `copilot_chat`.
- `crm-copilot-monitor` → feature `copilot_crm`.
- `prompt-generator` → feature `script_generation` (ou `prompt_generator`).
- `batch-generate-scripts` → feature `script_generation_batch`, um log por item gerado.

Em todos: capturar `client_id` quando disponível no body/JWT; em falha (status != 200) registrar `status='failed'`, `error_reason='ai_<status>'` e o tempo decorrido.

### 4. Dashboard `AIUsageDashboard.tsx`
- Acrescentar `cost_usd` e `audio_seconds` ao tipo `Row` e ao `select`.
- Novos KPIs (linha extra de cards):
  - **Custo total (USD)** — soma de `cost_usd`
  - **Minutos de áudio** — soma de `audio_seconds`/60
  - **USD / minuto** — custo transcrição ÷ minutos
- Tabela "Uso por agente": colunas **Custo (USD)**, **Minutos** (vazio quando não aplicável), **USD/min** (somente para features de transcrição).
- Tabela "Logs recentes": coluna **Custo** (`$0.000508`) e **Duração** (s) quando houver.
- Adicionar entradas faltantes em `FEATURE_LABELS` para os novos identificadores (`support_image_describe`, `chat_process`, `script_generation_batch`, etc.).

## Detalhes técnicos

- Lovable Gateway pode não retornar `cost`; nesses casos `cost_usd` fica `null` e o dashboard ignora na soma (não conta como zero distorcido).
- Cálculo USD/min defendido contra divisão por zero.
- Nenhuma mudança em RLS — políticas `ai_usage_logs_*` já permitem insert/select.
- Log é fire-and-forget (não bloqueia resposta ao usuário); erros do logger são apenas `console.warn`.

## Arquivos
- `supabase/migrations/<timestamp>_ai_usage_logs_cost.sql` (novo)
- `supabase/functions/_shared/aiUsageLogger.ts` (novo)
- `supabase/functions/chat-transcribe-audio/index.ts`
- `supabase/functions/support-transcribe-audio/index.ts`
- `supabase/functions/chat-ai-assist/index.ts`
- `supabase/functions/chat-ai-process/index.ts`
- `supabase/functions/copilot-chat/index.ts`
- `supabase/functions/crm-copilot-monitor/index.ts`
- `supabase/functions/prompt-generator/index.ts`
- `supabase/functions/batch-generate-scripts/index.ts`
- `src/pages/configuracoes/components/AIUsageDashboard.tsx`
