# Áudio recebido, resposta em texto — diagnóstico e correção

## O que os dados mostram (verificado)

Sessão do lead 5534991633679 (09/08, 16:25 BRT):

- O áudio do lead chegou (`chat_messages` type `audio`) e **foi transcrito com sucesso**: `metadata.transcription_internal.text = "Meu nome é Mário."` (whisper-1 via OpenRouter).
- O agente entendeu e respondeu: registrou o nome, moveu para `triagem` e enviou **duas mensagens de texto** ("Mário, prazer em conhecer você! 😊" / "Para começarmos, qual é o assunto...").
- Os 3 agentes X-Julia estão com `voice_enabled = true`, provedor `elevenlabs`, `voice_id fhtZMBwha5du5OxuvexO`, `voice_key_mode = default`, e existe chave `elevenlabs` (kind `voice`) em `xj_provider_settings`.

Ou seja: a compreensão do áudio funcionou; o que falhou foi **responder em áudio**.

## Causa

No `runner.ts`, quando o lead manda áudio e a voz está ligada, o motor chama a síntese e, **se ela falhar, cai silenciosamente para texto** — sem registrar nada em `xj_session_events`. Como não há nenhum evento de voz nem erro nos logs do turno, a falha da síntese (chave/voz/quota do ElevenLabs) é a explicação mais compatível com o comportamento observado, mas **não está confirmada**, porque hoje o erro é descartado.

Por isso o passo 1 é tornar essa falha visível; o passo seguinte corrige o que o teste apontar.

## Plano

### 1. Observabilidade da voz (torna o motivo visível)
- Em `runner.ts`, registrar em `xj_session_events` um evento `voice`:
  - `status: ok` com provedor/voz/duração quando o áudio for gerado;
  - `status: error` com a mensagem do provedor (ex.: `elevenlabs 401: ...`) quando falhar, **antes** de cair para texto.
- Logar também no console do motor (`[x-julia/tts]`), para aparecer nos logs da função.
- Exibir esses eventos na tela de Sessões, com rótulo próprio para voz.

### 2. Teste de voz no editor do agente
- Botão "Testar voz" na aba de voz do agente: sintetiza uma frase curta e mostra o erro exato (chave inválida, voz inexistente, sem créditos) ou toca o áudio gerado.
- O escritório valida a configuração sem depender de um lead real.

### 3. Corrigir o envio de áudio
- Se a síntese funcionar e o envio falhar, registrar `send` com status `error` (hoje é silencioso).
- Áudio na UaZapi não aceita legenda: enviar o áudio **sem** caption e, quando a resposta tiver blocos com link de mídia (vídeo/pdf), enviar esses blocos separados em vez de narrar a URL.
- Persistir a mensagem no chat como `ptt` (nota de voz) em vez de `audio`, para o balão aparecer como áudio do WhatsApp.

### 4. Validar de ponta a ponta
- Após o deploy: enviar um áudio de teste e conferir na tela de Sessões o evento `voice` (ok ou o erro exato) e o balão de áudio no chat.
- Se vier `error`, basta repor/ajustar a chave ou o `voice_id` do ElevenLabs — sem mexer em código.

## Detalhes técnicos
- Arquivos: `supabase/functions/_shared/x-julia/runner.ts` (log + envio), `tts.ts` (erro detalhado), `supabase/functions/x-julia-engine/index.ts` (ação `test_voice`), `src/modules/x-julia/pages/AgentEditorPage.tsx` (botão de teste), `src/modules/x-julia/pages/SessionsPage.tsx` (evento de voz).
- Sem migration nova: `xj_session_events` já aceita `kind` livre.
- Nada muda no fluxo de texto nem na transcrição existente.