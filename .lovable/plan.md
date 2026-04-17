

## Diagnóstico

A aparência de "enviado" sem chegar ao WhatsApp tem **3 causas combinadas** no fluxo `sendMessage`/`sendMedia` em `WhatsAppDataContext.tsx` → `uazapi-proxy`:

### 1. Endpoint UaZapi errado
O frontend chama:
- `/message/sendText`, `/message/sendImage`, `/message/sendVideo`, `/message/sendAudio`, `/message/sendDocument`

Mas a API UaZapi (e nosso adapter oficial em `supabase/functions/_shared/uazapi-adapter.ts`) usa:
- `/send/text` para texto
- `/send/media` para qualquer mídia (com `mediaType: 'image'|'video'|'audio'|'document'`)

Resultado: UaZapi responde 404. Mensagem nunca sai.

### 2. `uazapi-proxy` mascara erros como sucesso
O proxy sempre devolve HTTP 200 e empacota o status real em `{status, ok, data}`. O frontend só checa `error` do `supabase.functions.invoke` (que é só erro de rede/edge), nunca `data.ok` ou `data.status`. Por isso a UI marca como "sent" e grava no banco mesmo quando UaZapi rejeita.

### 3. Payload de mídia errado
Está enviando `{ mediaBase64, mimetype, fileName, caption }`, mas o UaZapi espera `{ number, mediaUrl, mediaType, caption }`. Como subimos a mídia ao Storage logo antes (`persistedUrl`), basta usar essa URL pública.

## Plano de correção

### A. `src/contexts/WhatsAppDataContext.tsx` — `sendMessage` (texto)

1. Trocar endpoint `/message/sendText` → `/send/text`.
2. Após `invoke('uazapi-proxy', ...)`, validar `data?.ok === true`. Se falso, lançar erro com `data?.data?.message || data?.status`.
3. Extrair `externalMessageId` corretamente: `data.data?.key?.id || data.data?.id || data.data?.messageId`.

### B. `src/contexts/WhatsAppDataContext.tsx` — `sendMedia`

1. Trocar `endpointMap` para usar `/send/media` em todos os tipos de mídia.
2. Substituir payload por: `{ number, mediaUrl: persistedUrl, mediaType: type, caption }`. (Reordenar para subir mídia ao Storage **antes** de chamar o UaZapi, garantindo `persistedUrl` válido.)
3. Falhar o envio (não apenas warn) se o upload ao Storage falhar — sem URL pública não dá pra enviar via UaZapi.
4. Mesma validação de `data.ok` da etapa A.
5. Em caso de falha, NÃO inserir em `chat_messages` e marcar bolha como `failed` com mensagem clara.

### C. WABA: igualmente checar resposta

Aplicar a mesma validação `if (error || data?.error) throw …` no caminho `waba-send` para consistência.

### D. Remover insert quando falhar

Hoje, o insert em `chat_messages` ocorre depois do envio — mas como a validação está fraca, está inserindo até em falha. Após (A/B), o `throw` no `try` cai no `catch` e marca `failed` corretamente.

### E. Validação manual

1. Selecionar uma conversa → enviar texto → confirmar chegada no WhatsApp do destinatário.
2. Enviar imagem, documento e áudio → confirmar entrega + URL persistida.
3. Forçar erro (ex: número inválido) → bolha deve ficar vermelha "falhou", sem inserir mensagem fantasma no banco.

### Arquivos a editar
- `src/contexts/WhatsAppDataContext.tsx` — corrigir endpoints, payload de mídia, validação `data.ok`, ordem do upload, parsing de `messageId`.

### Por que não mexer no `uazapi-proxy`
Ele já funciona como passthrough genérico e devolve `status/ok/data` — outros consumidores podem depender disso. A correção fica isolada no chamador.

