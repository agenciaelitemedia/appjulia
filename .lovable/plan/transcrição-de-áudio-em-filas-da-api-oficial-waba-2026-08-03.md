# Transcrição de áudio em filas da API Oficial (WABA)

## Diagnóstico (confirmado)

A mensagem "credenciais da fila ausentes" vem de `chat-transcribe-audio` quando a fila da conversa não tem `evo_url`/`evo_apikey` (credenciais UaZapi).

Consulta ao banco confirma: todas as falhas com esse motivo estão na fila **BPC/LOAS - COMERCIAL** (`channel_type = waba`, `hub = waba`), que por definição não tem credenciais UaZapi — ela usa `waba_token` / `waba_number_id`. A última ocorrência é o áudio de hoje 03/08 15:54 (marcado como falho às 17:05).

Ou seja: não é falta de configuração da fila nem de crédito de IA. A função de transcrição só sabe baixar áudio pela UaZapi (`POST /message/download`) e não tem o caminho da API Oficial.

## Correção proposta

Tornar `chat-transcribe-audio` ciente do canal, reaproveitando o que já existe:

1. Detectar o canal da fila/mensagem (`queues.channel_type` em `waba`/`whatsapp_waba`, ou `media_url` com prefixo `waba_media:`).
2. Canal UaZapi: manter exatamente o fluxo atual (`/message/download` com `token`), sem alteração de comportamento.
3. Canal WABA: obter o áudio pelo caminho já usado na exibição de mídia — `waba-send` com `action: download_media` (que devolve base64 + mimetype) usando `queue_id` da fila WABA, com o mesmo fallback de "qualquer fila WABA do client com credenciais" que `chat-media-download` já aplica. Se a mídia já estiver persistida em `chat-media`, baixar dessa URL em vez de chamar a Graph API novamente.
4. Só marcar `queue_credentials_missing` quando a fila realmente não tiver credencial do seu próprio canal; para WABA o motivo passa a ser específico (ex.: `waba_credentials_missing`), com o rótulo correspondente em `TranscriptionBlock.tsx`.
5. Reprocessar (via `force: true`) os áudios dessa fila que ficaram marcados como `queue_credentials_missing`, para que apareçam transcritos sem ação manual do usuário.

O restante do fluxo (limite de tamanho, provedor de IA, `metadata.transcription`, log de uso) fica inalterado.

## Detalhes técnicos

- Arquivos: `supabase/functions/chat-transcribe-audio/index.ts` (principal) e `src/components/chat/messages/TranscriptionBlock.tsx` (novo rótulo de motivo).
- Reutilizar `extractWabaMediaId`/`isWabaMessage` no mesmo formato de `chat-media-download` (id em `media_url` `waba_media:<id>` ou em `raw_payload.audio.id`).
- Select da mensagem precisa incluir `media_url`, `channel_type` e `raw_payload`.
- Sem migração de banco; sem mudança de contrato da função (mesmo body `{ message_id, force }`).
