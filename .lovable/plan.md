
## Problema
No preview da última mensagem (lista de conversas e/ou último-texto), mídias enviadas via UaZapi aparecem como `[object Object]` em vez de "📎 Documento", "🎵 Áudio", etc.

## Investigação necessária
Preciso confirmar onde o `last_message_text` está sendo gerado/escrito como objeto. Pelos network logs vejo que mensagens recebidas (documentos com payload JSON em `text`) chegam no banco com `text` contendo um JSON stringificado — então o `last_message_text` provavelmente está sendo populado com esse JSON ou com o objeto cru `[object Object]` em algum ponto.

Vou investigar:
1. Onde `last_message_text` é atualizado (insert/update de `chat_contacts`).
2. Ingestão de mensagens UaZapi (webhook) — como o `text` é normalizado para mídia.
3. Componente da lista de chat que renderiza o preview — se há fallback para objeto.
4. Função de envio de mídia (`sendMedia`) — se atualiza `last_message_text` com o `File` ou objeto.

## Plano de correção

1. **Helper único de preview** (`src/lib/chat/messagePreview.ts`)
   - Função `getMessagePreview(message)` que retorna string segura por tipo:
     - `image` → "📷 Imagem" (+ caption se houver)
     - `video` → "🎥 Vídeo"
     - `audio`/`ptt` → "🎵 Áudio"
     - `document` → "📎 " + (file_name || "Documento")
     - `sticker` → "Sticker"
     - `location` → "📍 Localização"
     - `contact` → "👤 Contato"
     - `text` → texto truncado, **nunca** stringify de objeto
   - Detecta e ignora valores como `[object Object]`, JSON crus de mídia (string começando com `{"URL"`), retornando o label do tipo.

2. **Atualizar pontos de escrita do `last_message_text`**
   - `WhatsAppDataContext.tsx` (envio): usar `getMessagePreview` ao gravar `chat_contacts.last_message_text` e `last_message_at` após `sendMedia`/`sendMessage`, em vez de passar `file`/objeto.
   - Webhook de ingestão UaZapi (edge function): aplicar o mesmo helper antes de salvar `last_message_text` para mídias recebidas (substituir o JSON cru por "📎 Documento", etc.).

3. **Atualizar a renderização da lista**
   - Componente da lista de conversas (chat sidebar, estilo Helena) e atendimento humano: usar `getMessagePreview({ type, text: last_message_text, file_name })` para exibir o preview, garantindo fallback mesmo para registros antigos com `[object Object]` ou JSON cru.

4. **Backfill leve (opcional, no client)**
   - Não rodar migration; o helper de exibição já cobre registros antigos automaticamente.

## Arquivos a alterar
- `src/lib/chat/messagePreview.ts` (novo)
- `src/contexts/WhatsAppDataContext.tsx` (escrita correta no `last_message_text`)
- `supabase/functions/<webhook ingestão UaZapi>/index.ts` (escrita correta na ingestão)
- Componente da lista de conversas em `/chat` e `/atendimento-humano` (exibição segura)

## Resultado esperado
- Nenhum preview mostra `[object Object]` ou JSON cru de mídia.
- Mídias enviadas e recebidas exibem rótulo amigável com ícone.
- Texto puro continua aparecendo normalmente.
- UaZapi e WABA tratados de forma idêntica.
