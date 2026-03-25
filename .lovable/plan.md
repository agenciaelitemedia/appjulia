

# Ajustar popup de chat para suportar UaZapi e API Oficial (WABA)

## Problema atual

O `WhatsAppMessagesDialog` só funciona com UaZapi. Quando o agente usa API Oficial da Meta (`hub = 'waba'`), o popup não carrega mensagens nem consegue enviar.

## Diferenças entre os provedores

```text
                    UaZapi                          WABA (API Oficial)
─────────────────────────────────────────────────────────────────────────
Buscar mensagens    POST /message/find              Sem endpoint de leitura.
                    (via UaZapiClient)              Mensagens recebidas ficam na
                                                    tabela webhook_queue/webhook_logs.

Enviar texto        POST /send/text                 POST graph.facebook.com/v22.0/
                    (via UaZapiClient)              {phone_number_id}/messages
                                                    (via edge function waba-send)

Download mídia      POST /message/download          GET graph.facebook.com/v22.0/{media_id}
                    (via UaZapiClient)              (via edge function waba-send)

Credenciais         evo_url, evo_apikey,            waba_token, waba_number_id,
                    evo_instance                    waba_id
```

## Plano de alterações

### 1. Alterar query de credenciais para incluir `hub` e campos WABA

No `loadAgentCredentials`, buscar também `hub`, `waba_token`, `waba_number_id`, `waba_id` da tabela `agents`. Armazenar num state `provider` que indica qual API usar.

### 2. Criar edge function `waba-send` (nova)

Para enviar mensagens de texto via WABA e para baixar mídia. Actions:
- `send_text`: envia texto via Graph API `/{phone_number_id}/messages`
- `download_media`: baixa mídia via Graph API `/{media_id}` com token do agente
- `get_media_url`: obtém URL de mídia de um media_id

Recebe `waba_token`, `phone_number_id` e os dados da mensagem. Valida campos obrigatórios server-side.

### 3. Carregar mensagens WABA da tabela `webhook_logs`

Para WABA, buscar mensagens da tabela `webhook_logs` filtradas por `from_number` (número do contato) e `waba_id` do agente. Extrair texto, tipo, timestamp e payload do campo `payload` (JSON raw da Meta).

Parser dedicado para o formato Meta:
- `payload.entry[].changes[].value.messages[]` → extrai texto, imagem, vídeo, áudio, documento
- Tipos: `text.body`, `image.id/caption`, `video.id/caption`, `audio.id`, `document.id/filename`

### 4. Enviar mensagem WABA via edge function

Quando `hub === 'waba'`, o `handleSendMessage` chama `supabase.functions.invoke('waba-send', ...)` em vez do `UaZapiClient`.

### 5. Download de mídia WABA

Para mídia WABA, os IDs de mídia vêm no payload do webhook. O download usa a edge function `waba-send` com action `download_media` que faz proxy da Graph API.

### 6. Manter parsing UaZapi intacto

Todo o código existente de `detectMessageType`, `extractMediaData`, `parseMessages` continua funcionando para UaZapi. O código WABA é uma branch separada.

## Arquivos alterados

| Arquivo | O que muda |
|---|---|
| `src/pages/crm/components/WhatsAppMessagesDialog.tsx` | Adiciona state `provider`, branch na query de credenciais, `loadMessages` e `handleSendMessage` por provider. Parser WABA para webhook_logs. |
| `supabase/functions/waba-send/index.ts` | Nova edge function para enviar mensagens e baixar mídia via Graph API |

## Segurança

- A edge function `waba-send` valida campos obrigatórios e não expõe tokens ao frontend
- Credenciais WABA são buscadas server-side na edge function a partir do `cod_agent`
- Nenhuma alteração em RLS (webhook_logs já tem política adequada)

