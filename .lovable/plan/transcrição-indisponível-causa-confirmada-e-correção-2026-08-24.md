# Transcrição indisponível — causa confirmada e correção

## Diagnóstico (verificado nos dados)

- Todas as falhas recentes de transcrição têm o motivo `ai_402`: 61 mensagens nos últimos 7 dias, a mais recente hoje 12:50 UTC.
- Os logs de uso mostram que essas chamadas vão para o endpoint de áudio da **OpenRouter** com o modelo `openai/whisper-1` (a configuração global da feature `chat_transcription` está com provedor OpenRouter e existe uma chave salva).
- A última transcrição bem-sucedida por esse caminho foi em 22/08 às 15:03; depois disso só `ai_402`.
- `402` = pagamento/créditos: a conta OpenRouter usada está sem saldo. Não é bug de código nem de mídia (os poucos `download_failed` são outro caso, 8 ocorrências).

Ou seja: a transcrição para de funcionar porque o provedor externo recusa as chamadas por falta de crédito, e a interface traduz isso como a mensagem genérica "erro na chamada à IA".

## O que será feito

1. **Fallback automático de provedor**: quando a OpenRouter recusar por cobrança/autorização (402, 401, 403), a função de transcrição repete a chamada uma única vez pelo Lovable AI (Gemini), que não depende de saldo externo. Assim o áudio é transcrito normalmente mesmo com a conta OpenRouter zerada.
2. **Mensagem clara quando nada funcionar**: se também falhar no fallback, a caixa de transcrição passa a dizer o motivo real em vez de "erro na chamada à IA":
   - 402 → "sem crédito no provedor de IA"
   - 401/403 → "chave do provedor de IA inválida"
3. **Aviso na tela de configuração de IA's**: indicação visual quando o provedor selecionado estiver recusando por cobrança, para o administrador saber que precisa repor crédito ou trocar o provedor para Lovable AI.
4. **Retentativa dos áudios afetados**: o botão "Tentar novamente" já existente passará a funcionar para os 61 áudios marcados como indisponíveis, agora usando o fallback.

Nada muda para quem já tem a OpenRouter com saldo — o caminho principal continua igual.

## Detalhes técnicos

- `supabase/functions/chat-transcribe-audio/index.ts`
  - extrair `callAI` para aceitar um `ResolvedAI` como parâmetro;
  - se `!aiResp.ok` e `status ∈ {401, 402, 403}` e `ai.provider === 'openrouter'`, montar um `ResolvedAI` Lovable (`FEATURE_DEFAULT_MODEL.chat_transcription`, `LOVABLE_API_KEY`, endpoint chat-completions com `input_audio`) e repetir a chamada uma vez;
  - registrar ambas as tentativas em `ai_usage_logs` (a primeira com `error_reason: ai_402`, a segunda com o resultado real e `context.fallback_from: 'openrouter'`);
  - só marcar `markFailed` se o fallback também falhar; motivo gravado passa a ser o do fallback.
- `supabase/functions/_shared/aiGateway.ts` — exportar um helper `lovableAI(feature)` para montar o `ResolvedAI` de fallback sem duplicar constantes (o `LOVABLE_GATEWAY` já existe no arquivo).
- `src/components/chat/messages/TranscriptionBlock.tsx` — acrescentar em `translateReason`: `ai_402` → "sem crédito no provedor de IA", `ai_401`/`ai_403` → "chave do provedor de IA inválida" (mantendo os regex genéricos como fallback).
- `src/pages/configuracoes` (aba IA's) — banner de alerta na feature `chat_transcription` quando houver `ai_usage_logs` recentes com `error_reason` iniciando em `ai_40`.
- Deploy: apenas `chat-transcribe-audio`. Sem migração de banco.
