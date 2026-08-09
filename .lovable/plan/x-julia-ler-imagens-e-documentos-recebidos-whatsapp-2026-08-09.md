# X-Julia: ler imagens e documentos recebidos (WhatsApp)

## O que está acontecendo

A mensagem "Recebi outra imagem, mas não consegui ler o conteúdo" é o texto de fallback do agente: a leitura da mídia falhou antes de chegar ao modelo.

Causa confirmada no código:

- O webhook da UaZapi (`uazapi-chat-webhook`) envia ao motor do agente a `media_url` crua da mensagem. Na UaZapi essa URL aponta para o arquivo **criptografado (`.enc`)** — regra já documentada no projeto: mídia precisa ser baixada via `POST /message/download` para ser decriptada.
- A leitura de mídia do agente (`_shared/x-julia/documents.ts`) faz `fetch` direto nessa URL e manda o link/base64 para o modelo. O conteúdo chega criptografado (ou o fetch falha), o modelo não lê e cai no fallback neutro.
- Em filas de API Oficial (WABA), a `media_url` é gravada como `waba_media:<id>`, que não é uma URL buscável — mesmo efeito.
- Áudio já funciona porque passa pela função `chat-transcribe-audio`, que faz o download decriptado corretamente. Imagem/PDF/planilha não têm esse caminho.

## Correção proposta

Criar um resolvedor de mídia único para o agente, espelhando o que a transcrição de áudio já faz, e usá-lo antes de enviar qualquer mídia ao modelo:

1. Novo módulo `_shared/x-julia/media.ts` com `xjResolveMediaBytes(supabase, message_id)`:
   - Busca a mensagem em `chat_messages` (media_url, mimetype, file_name, canal e fila).
   - **UaZapi**: pega credenciais da fila e chama `POST /message/download` para obter o arquivo decriptado em base64.
   - **WABA**: quando a `media_url` tem prefixo `waba_media:`, resolve via `waba-send` (`download_media`) ou pelo bucket de storage, como a transcrição já faz.
   - **URL pública normal**: mantém o `fetch` direto atual como fallback.
   - Retorna `{ base64, mimeType, fileName }` ou `null`.
2. Em `documents.ts`, usar esse resolvedor como primeira via para imagem, sticker, vídeo, PDF, planilha e texto; o `fetch` direto na `media_url` fica apenas como último recurso.
   - Imagem: enviar como `data:<mime>;base64,...` no bloco `image_url`.
   - PDF: bloco `file` com `file_data` base64.
   - Planilha/CSV/texto: extração local já existente, agora sobre os bytes decriptados.
3. Manter o comportamento "o agente nunca para": se nada funcionar, continua a resposta neutra pedindo que o lead descreva — mas agora com log explícito do motivo (`enc_download_failed`, `no_credentials`, `unsupported_mime`) para diagnóstico.
4. Redeploy do `x-julia-engine` e teste com uma imagem real do lead, conferindo nos logs que o modelo recebeu bytes decriptados.

## Detalhes técnicos

- Reaproveitar a lógica de credenciais de fila e de download já presente em `supabase/functions/chat-transcribe-audio/index.ts` (UaZapi `/message/download` e WABA `download_media`), extraindo-a para o módulo compartilhado sem alterar o comportamento da transcrição.
- Nada muda no chat, no webhook, nem no schema; a alteração é isolada na leitura de mídia do agente.
