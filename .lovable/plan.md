# Plano: Estabilizar transcrição + Sistema de logs de uso de IA

## Parte 1: Correção do erro 500 (RUNTIME_ERROR) na transcrição

**Diagnóstico confirmado:** O `chat-transcribe-audio` já usa `resolveAI(supabase, "chat_transcription")` do `_shared/aiGateway.ts`, que **suporta OpenRouter** automaticamente quando configurado em `client_ai_model_config.provider = 'openrouter'` (com chave em `ai_provider_keys`). Hoje está caindo no Lovable Gateway porque ou (a) não há config OpenRouter ativa, ou (b) a config aponta Lovable e o Gemini 2.5 Flash está retornando 500 para o áudio.

### Edge function `chat-transcribe-audio`
- **Nunca retornar status ≥ 400** ao cliente. Toda falha vira `200 { ok:false, error, fallback:true, reason }` — elimina o `RUNTIME_ERROR` capturado pelo handler global do Lovable.
- Persistir o erro em `metadata.transcription = { status:'failed', reason, endpoint, provider, model, generated_at }` para o retry aparecer imediatamente.
- **Fallback de modelo:** se o modelo configurado retornar 5xx, tentar uma vez com `google/gemini-2.5-pro` antes de marcar como falha.
- Limite explícito: áudio > ~20MB → `reason:'audio_too_large'`.

### `TranscriptionBlock.tsx`
- Tratar `data.ok === false` como falha lógica (sem throw); atualizar `localTranscription` para `status:'failed'` + mostrar `reason` traduzido abaixo do título.
- Manter botão ↻ Tentar novamente já implementado.

---

## Parte 2: Tabela de logs de uso de IA (`ai_usage_logs`)

Nova tabela genérica para auditoria/billing de qualquer agente de IA. Primeiro consumidor: transcrição de áudio.

### Schema (migration)
```sql
CREATE TABLE public.ai_usage_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  client_id     text,                           -- chat_conversations.client_id
  feature       text NOT NULL,                  -- 'chat_transcription', 'chat_assist', ...
  provider      text NOT NULL,                  -- 'lovable' | 'openrouter'
  endpoint      text NOT NULL,                  -- URL completa do gateway
  model         text NOT NULL,                  -- 'google/gemini-2.5-flash', ...
  status        text NOT NULL,                  -- 'ok' | 'failed' | 'fallback'
  duration_ms   integer,                        -- tempo total da chamada
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens  integer,
  -- Contexto específico (jsonb flexível p/ futuros agentes)
  context       jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Para transcrição: { audio_url, audio_duration_s, message_id, conversation_id, mimetype }
  error_reason  text,
  user_id       text
);

CREATE INDEX idx_ai_usage_logs_client_feature_date
  ON public.ai_usage_logs (client_id, feature, created_at DESC);
CREATE INDEX idx_ai_usage_logs_feature_date
  ON public.ai_usage_logs (feature, created_at DESC);

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Leitura: somente admin (via has_role pattern já existente no projeto)
CREATE POLICY "Admins read ai_usage_logs"
  ON public.ai_usage_logs FOR SELECT
  USING (true);  -- ajustar conforme padrão admin do projeto

-- Insert: service role (edge functions)
CREATE POLICY "Service can insert ai_usage_logs"
  ON public.ai_usage_logs FOR INSERT
  WITH CHECK (true);
```

### Instrumentação em `chat-transcribe-audio`
Após cada chamada ao gateway (sucesso ou falha), inserir 1 linha:
- Tempo total medido com `performance.now()`.
- `total_tokens`, `prompt_tokens`, `completion_tokens` lidos de `aiData.usage` (formato OpenAI; tanto Lovable quanto OpenRouter retornam).
- `context.audio_url`, `audio_duration_s` (se disponível no UaZapi response), `message_id`, `conversation_id`, `mimetype`.
- `status`: `ok` (sucesso primeiro modelo), `fallback` (caiu no Gemini Pro), `failed`.

---

## Parte 3: Nova aba "IA's Dashboard" em `/configuracoes`

### `src/pages/configuracoes/ConfiguracoesPage.tsx`
Adicionar 5ª aba (ícone `BarChart3`):
```
| IA's | History UaZapi | Monitor da Fila | Manutenção | IA's Dashboard |
```

### Novo `src/pages/configuracoes/components/AIUsageDashboard.tsx`
**Filtros (topo):**
- Período (date range — preset 7d/30d/90d)
- Cliente (`client_id`) — combobox alimentado por `distinct client_id` da tabela
- Agente/feature (multi-select: chat_transcription, chat_assist, chat_resume, copilot_crm, copilot_chat, support_transcription, etc.)

**Cards de KPI (topo):**
- Total de chamadas
- Total de tokens (prompt + completion)
- Custo estimado (placeholder — tabela de preços por modelo virá depois)
- Taxa de sucesso (%)
- Latência média (ms)

**Tabela "Uso por agente"** (1 linha por feature):
| Agente | Chamadas | Tokens prompt | Tokens completion | Total | Latência média | % falha | Modelo predominante | Provider |

**Gráfico:**
- Linha temporal por agente (chamadas/dia) usando Recharts (já no projeto).
- Barras horizontais com top 5 clientes por consumo (quando filtro de cliente não está aplicado).

**Tabela de logs recentes** (paginada, 50/pág):
Timestamp · Cliente · Agente · Modelo · Provider · Tokens · Latência · Status · (botão ver contexto JSON)

### Hook `useAIUsageMetrics.ts`
Consultas agregadas via Supabase JS:
```ts
supabase.from('ai_usage_logs')
  .select('feature, provider, model, status, total_tokens, duration_ms')
  .gte('created_at', from).lte('created_at', to)
  .eq('client_id', clientId) // quando filtro ativo
```
Agregações feitas client-side (volumes pequenos por filtro). Para volumes grandes, criar `get_ai_usage_summary(client_id, from, to)` RPC depois.

---

## Critérios de aceitação
- Transcrição falhada não gera mais `RUNTIME_ERROR`; mostra caixa com `reason` + botão Tentar novamente.
- Cada execução de transcrição (ok, fallback ou falha) grava 1 linha em `ai_usage_logs` com tokens, latência, endpoint, provider, modelo e `context.audio_url`.
- Nova aba "IA's Dashboard" em `/configuracoes` permite filtrar por cliente e agente, exibe KPIs, tabela agregada por agente, gráfico temporal e logs recentes.
- OpenRouter, quando configurado em `client_ai_model_config`, é usado e aparece como `provider:'openrouter'` nos logs.

## Notas técnicas
- `resolveAI` já lê `client_ai_model_config` (mais recente por `feature`). Não exige mudanças para suportar OpenRouter em transcrição — basta configurar via UI existente em "IA's".
- A coluna `context jsonb` evita migrations futuras quando outros agentes (copilot, autoreply, support) começarem a logar.
- Permissões da aba "IA's Dashboard": gate via `isAdmin` no Tabs (mesmo padrão de `ChatSettingsPage`).
