# X-Julia: entender áudio do lead usando a transcrição existente

## Situação atual (verificada)

- O webhook UaZapi já envia ao `x-julia-engine` o `message_id` real da linha em `chat_messages` para cada mensagem do lead — então o motor sabe exatamente qual áudio foi recebido.
- A transcrição automática (`chat-transcribe-audio`) só é disparada quando a flag `auto_transcribe_audio` está ligada **no cliente E na fila**. Se estiver desligada, nenhuma transcrição é gerada.
- Sem transcrição, o X-Julia tenta ler o áudio por conta própria (baixando `media_url` direto e mandando para o modelo). Em UaZapi o arquivo vem criptografado (`.enc`), então essa leitura falha com frequência e o agente responde no escuro.
- No chat, a caixa de transcrição aparece sempre que existir `metadata.transcription` na mensagem — ou seja, se simplesmente forçássemos a transcrição, o texto apareceria para o usuário mesmo com a permissão desligada.

## O que será feito

1. **Transcrição sob demanda para o agente**: ao receber áudio/ptt, o X-Julia chama a função de transcrição já existente passando o `message_id`, com um marcador de uso interno, e usa o texto retornado como entrada do turno (o agente responde normalmente, como se fosse texto).
2. **Respeitar a permissão de exibição**: a função de transcrição passa a verificar as flags efetivas (cliente + fila).
   - Flags ligadas → grava como hoje em `metadata.transcription` (aparece no chat).
   - Flags desligadas → grava em `metadata.transcription_internal` (mesmo formato) e **não** aparece no chat; o texto volta na resposta da chamada para o agente usar.
3. **Aparecer depois, quando liberado**: quando a permissão for ativada para o cliente/fila, o chat passa a exibir a transcrição interna já existente (sem precisar gerar de novo).
4. **Nada muda para quem já usa**: chamadas atuais (webhook, botão "Gerar transcrição", "Tentar novamente") continuam gravando em `metadata.transcription` exatamente como hoje — o caminho interno só é usado quando o X-Julia pede.
5. **Fallback seguro**: se a transcrição falhar (credenciais, mídia ausente, IA indisponível), o X-Julia mantém o comportamento atual de tentar ler a mídia direto e, em último caso, segue a conversa pedindo ao lead que descreva — o agente nunca para.

## Detalhes técnicos

- `supabase/functions/chat-transcribe-audio/index.ts`
  - aceita `internal?: boolean` no body; retorna sempre `text` no payload de sucesso.
  - com `internal: true`, resolve as flags via `fetchEffectiveQueueFlags(client_id, queue_id)` (já existente em `_shared/agentSettings.ts`) e escolhe a chave de metadata: `transcription` (permitido) ou `transcription_internal` (não permitido). Idempotência (`already_transcribed`) passa a considerar as duas chaves; `force` continua reprocessando.
  - falhas com `internal: true` gravam o motivo na chave interna, para não sinalizar "indisponível" no chat de quem não tem a feature ligada.
- `supabase/functions/_shared/x-julia/documents.ts`
  - para `audio`/`ptt` com `inbound.message_id`: invoca `chat-transcribe-audio` (`{ message_id, internal: true }`) e usa o texto; se vier vazio/erro, cai no fluxo atual de leitura inline da mídia.
- `supabase/functions/_shared/x-julia/types.ts` — sem mudança de contrato (o `message_id` já existe no inbound).
- `src/components/chat/MessageBubble.tsx` — quando `canTranscribe` for verdadeiro e não houver `metadata.transcription`, usa `metadata.transcription_internal` como fonte do bloco de transcrição. Com permissão desligada, nada é exibido (inclusive a interna).
- Deploy das funções: `chat-transcribe-audio` e `x-julia-engine` (que empacota o `_shared/x-julia`).
- Sem migração de banco; sem alteração no webhook UaZapi.
