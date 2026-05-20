---
name: AI Features Prompt Editor
description: Tela /configuracoes > IA's com features chat_resume e chat_transcription editáveis
type: feature
---

Tabela: `client_ai_model_config(client_id, feature, provider, model, prompt)` — coluna `prompt text NULL` adicionada para customização per-client.

Features adicionadas (além de `chat_assist`):
- `chat_resume`: usado por `chat-ai-assist incremental_summary` para gerar resumos da conversa. Default prompt foca no relato do cliente e usa resumos anteriores como contexto acumulado.
- `chat_transcription`: usado por `chat-transcribe-audio` para transcrever áudios. Default prompt pede transcrição fiel pt-BR.

Frontend (`useAIModelsConfig` + `AIModelsConfig.tsx`): listagem com botão de editar prompt (diálogo) e "Restaurar padrão". Hook faz upsert parcial; linhas `NULL` em `prompt` caem no default literal da edge function via `getPrompt()`.

Edge function helper: `getPrompt(clientId, feature, fallback)` em `chat-ai-assist`; `getTranscriptionPrompt()` em `chat-transcribe-audio`.