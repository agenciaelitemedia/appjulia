## Objetivo

No detalhe do chamado (`/tickets/:id`), permitir colar (Ctrl/Cmd+V) uma imagem dentro do textarea de "Resposta/Nota interna". A imagem aparece como pré-visualização abaixo do texto, é enviada anexada à mensagem do chamado e, se "Enviar para WhatsApp" estiver ligado, também é enviada como mídia na conversa do solicitante.

Anexos do módulo de chamados ficam **separados** dos anexos do chat: novo bucket `ticket-media` e nova edge function `ticket-media-upload`. A coluna `attachments jsonb` em `support_ticket_messages` já existe — sem migração.

## Mudanças

### 1. Storage — novo bucket `ticket-media`
- Criar bucket público `ticket-media` via tool (`supabase--storage_create_bucket`).
- Path padrão: `tickets/<ticket_id>/<uuid>-<filename>`.
- Independente de `chat-media`; políticas RLS em `storage.objects` permitindo upload por `service_role` (a edge function usa service role) e leitura pública (bucket público).

### 2. Edge function — `supabase/functions/ticket-media-upload/index.ts`
- Estrutura espelhada de `chat-media-upload`, mas grava em `ticket-media` e em `tickets/<ticketId>/...`.
- Input: `{ base64, mimetype, fileName, ticketId, source: 'outgoing' | 'incoming' }`.
- Retorna `{ url, path, mimetype }` com URL pública.
- Sem dependência de `contactId`/`clientId` (ticket é a unidade do módulo).

### 3. Composer — `src/pages/tickets/TicketDetailPage.tsx`
- Novo estado: `pastedImage: { file: File; previewUrl: string } | null`.
- `onPaste` no `<Textarea>`: percorre `clipboardData.items`; se houver `image/*`, captura o `File`, gera `URL.createObjectURL` e armazena (`preventDefault` apenas quando há imagem; texto continua colando normalmente).
- Abaixo do textarea, quando `pastedImage` existir: thumbnail (~120px) com botão "X" para remover (revoga objectURL).
- `handleSend`: permite envio quando `draft.trim()` OU `pastedImage` (botão desabilitado só se ambos vazios). Passa `attachment: pastedImage?.file` para `reply.mutateAsync`. Após sucesso limpa `pastedImage`.

### 4. Mutation `reply` — `src/pages/tickets/hooks/useTickets.ts`
- Aceitar novo campo opcional `attachment?: File`.
- Quando houver `attachment`:
  - Ler como base64 e chamar `supabase.functions.invoke('ticket-media-upload', { body: { base64, mimetype, fileName, ticketId, source: 'outgoing' } })`.
  - Inserir `support_ticket_messages` com `attachments: [{ type: 'image', url, mimetype, file_name }]` (permitir `body` vazio quando houver anexo).
- Se `sendToWhatsApp` ativo + houver `attachment`: chamar `dispatchToWhatsApp` com `media: { url, mimetype, fileName, type: 'image', caption: body || null, base64 }`.

### 5. `dispatchToWhatsApp` — `src/pages/tickets/hooks/useTickets.ts`
- Novo parâmetro opcional `media`.
- Quando `media` presente:
  - **WABA**: `POST /messages` com `type: 'image'`, `image: { link: media.url, caption }`.
  - **UaZapi**: `POST /send/media` com `{ number, type: 'image', file: media.url, text: caption, fileName }` (fallback para `data:` base64 se a URL falhar).
  - Persistir em `chat_messages` com `type: 'image'`, `media_url: media.url`, `caption`, `metadata: { support_ticket_id, mimetype, attachment_bucket: 'ticket-media' }`.
- Sem `media`: comportamento de texto atual inalterado.

### 6. Renderização — `src/pages/tickets/components/TicketTimeline.tsx`
- Se `m.attachments` for array, renderizar miniaturas: `<img src={a.url} className="mt-2 max-h-64 rounded-md border cursor-zoom-in" />`, click abre em nova aba. Tipos não-imagem viram link com `file_name`.
- `TicketMessage` em `src/pages/tickets/types.ts`: adicionar `attachments?: Array<{ type: string; url: string; mimetype?: string; file_name?: string }>`.

## Observações
- Sem migração SQL (`attachments jsonb` já existe; bucket criado por tool, não por SQL).
- Drag-and-drop e botão de "anexar arquivo" ficam fora — somente colar imagem, como solicitado.
- Upload é best-effort para o registro do ticket (fallback inline data URL), mas obrigatório para envio ao WhatsApp (sem URL → toast de erro e mensagem permanece só no ticket, padrão `WhatsappDispatchError` atual).
- Memória nova a registrar após implementação: "Anexos de /tickets vivem em bucket `ticket-media`; chat usa `chat-media`."
