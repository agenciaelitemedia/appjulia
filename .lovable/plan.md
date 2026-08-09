# Envio em blocos e mídia automática (X-Julia)

## Objetivo
Ao enviar mensagens, o agente deve:
1. Quebrar a resposta em várias mensagens quando houver dupla quebra de linha (`\n\n`).
2. Detectar links de mídia dentro de cada bloco (vídeo `.mp4`, imagem `.jpg/.jpeg/.png/.webp/.gif`, áudio `.mp3/.ogg/.opus/.m4a`, documento `.pdf` etc.) e enviar pelo padrão de mídia já existente (`sendMedia`), em vez de mandar a URL como texto.

## Comportamento
- Blocos separados por `\n\n` (duas ou mais quebras) tornam-se mensagens sequenciais, na ordem, com pequeno intervalo entre elas para preservar a ordem de entrega.
- Bloco que contém **apenas** uma URL de mídia → envia a mídia sem legenda.
- Bloco com texto + URL de mídia → envia a mídia usando o texto restante como legenda (imagem/vídeo/documento). Para áudio (que não aceita legenda), envia o texto como mensagem separada antes do áudio.
- Bloco sem URL de mídia → mensagem de texto normal (links comuns continuam como texto).
- Persistência no chat mantém-se por bloco: cada mensagem enviada gera seu próprio registro em `chat_messages` com `type` correto (`text`/`image`/`video`/`audio`/`document`) e `media_url` quando aplicável.
- Se o envio de mídia falhar, faz fallback enviando o bloco como texto (assim nada é perdido).

## Detalhes técnicos
- Novo helper em `supabase/functions/_shared/x-julia/messaging.ts`:
  - `splitMessageBlocks(text)` — divide em `/\n\s*\n+/`, remove vazios e espaços nas pontas.
  - `detectMediaInBlock(block)` — regex de URL http(s) + mapeamento por extensão (ignorando querystring) para `image | video | audio | document`; retorna `{ url, type, caption }`.
  - `xjSendComposed(supabase, queue, session, text, options)` — orquestra split + detecção e chama o `xjSend` atual para cada parte (reutilizando o adapter `messaging-factory` e a persistência já existentes).
- `xjSend` permanece intacto (envio unitário), evitando quebrar chamadas atuais.
- Trocar por `xjSendComposed`:
  - `supabase/functions/_shared/x-julia/runner.ts` (resposta de texto do turno; o caminho de áudio TTS continua como está).
  - `supabase/functions/x-julia-followup-runner/index.ts` (mensagens de followup, que costumam ter blocos e links).
- Sem migration de banco e sem alteração de frontend.
