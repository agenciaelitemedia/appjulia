## Diagnóstico

Nas configurações o usuário selecionou:
- **Transcrição Wavoip** → provider `openrouter`, modelo `openai/whisper-large-v3`
- **Resumo Wavoip** → provider `openrouter`, modelo `deepseek/deepseek-v4-pro`

Porém a edge `wavoip-transcribe-recording` **ignora o provider** e sempre chama o gateway da Lovable, tanto para STT quanto para o chat de resumo (endpoints hardcoded `https://ai.gateway.lovable.dev/...`). Como `whisper-large-v3` não está no allowlist da Lovable, o gateway responde `400 invalid model` e a transcrição falha. É por isso que o log mostra repetidamente:

```
[wavoip-transcribe-recording] STT 400: invalid model: openai/whisper-large-v3
```

## Correção

### `supabase/functions/wavoip-transcribe-recording/index.ts`

1. **STT respeita o provider resolvido por `resolveAI('wavoip_transcription')`:**
   - `provider === 'openrouter'` → POST em `OPENROUTER_TRANSCRIBE_ENDPOINT` (`https://openrouter.ai/api/v1/audio/transcriptions`) com `Authorization: Bearer <chave OpenRouter>` e headers de `providerHeaders('openrouter')`.
   - Caso contrário → mantém o gateway da Lovable com `LOVABLE_API_KEY`.
   - Se `provider = openrouter` mas a chave não está configurada, cai automaticamente para Lovable + modelo default (`openai/gpt-4o-mini-transcribe`) e loga aviso (mesmo padrão do `aiGateway.ts`).
   - Fallback adicional: se a resposta for `400` com `invalid model`, re-tentar uma vez usando o default (`openai/gpt-4o-mini-transcribe` no Lovable) para não deixar a chamada travada só porque o admin escolheu um modelo incompatível.

2. **Resumo (chat) respeita o provider:** trocar o `callChat` hardcoded pelo endpoint/chave/headers vindos de `resolveAI('wavoip_call_summary')` (`sum.endpoint`, `sum.apiKey`, `providerHeaders(sum.provider)`).

3. Ajustar `logAIUsage` para refletir o `provider`/`endpoint` realmente usados (Lovable ou OpenRouter).

### Nada muda no frontend
As telas de `/configurações` já permitem escolher provider + modelo; o problema é 100% no backend que não estava roteando. O usuário mantém o modelo que quiser sem precisar re-configurar nada.

## Fora de escopo
- Não altero prompts, planos, UI, nem retranscrevo chamadas antigas (o botão "Iniciar transcrição" continua funcionando; após o fix, novas tentativas passam a usar o provider correto).
