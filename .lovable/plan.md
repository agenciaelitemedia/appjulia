## Problema

No `MessageBubble.tsx` (case `'document'`), o botão de download tem dois caminhos:

- **URL já decifrada** (`usable`): chama `forceDownload(mediaUrl, file_name)` → baixa.
- **URL ainda criptografada** (`.enc` / `mmg.whatsapp.net`): chama `handleDownload()` → busca via `chat-media-download`, atualiza `mediaUrl` no estado, **mas não dispara o download do arquivo**.

Resultado: ao clicar em "Baixar" num documento recém-recebido/enviado (cujo `media_url` ainda é o link criptografado do WhatsApp), nada acontece visualmente — o usuário precisaria clicar de novo. Diferente de imagem/vídeo/áudio, documentos não estão em `autoTypes`, então a URL nunca é resolvida automaticamente.

## Solução

Tornar o download de documento sempre em **um clique**, resolvendo a URL on-demand e disparando o download do arquivo na sequência.

### Mudanças em `src/components/chat/MessageBubble.tsx`

1. Adicionar uma função `handleDocumentDownload()` dentro de `MediaContent`:
   - Se `mediaUrl` já é utilizável → `forceDownload(mediaUrl, message.file_name)` direto.
   - Caso contrário → chamar `onDownload()`; se retornar `{ url }`, atualizar estado **e** chamar `forceDownload(res.url, message.file_name)` imediatamente.
   - Tratar `permanent` / `transient` mostrando o `FallbackBox` (estado já existente) e um toast de erro discreto.
   - Manter `isLoading` para mostrar o spinner durante a resolução.

2. No `case 'document'`, unificar o botão: sempre chamar `handleDocumentDownload`, mostrando spinner enquanto `isLoading`, ícone `Download` caso contrário. Remover a dupla renderização condicional (`usable ? … : …`) — fica só um botão.

3. Manter `FallbackBox` para casos `permanent` (mídia expirada no WhatsApp) — exibido no lugar do bloco do documento quando a resolução falha de forma permanente.

### Fora do escopo

- Não mexer em imagem/vídeo/áudio (já funcionam via auto-fetch).
- Não alterar `forceDownload`, `chat-media-download` ou contexto — a URL resolvida já é pública no bucket `chat-media`.
- Sem mudanças de backend/migrations.

## Validação

- Receber/enviar um PDF, clicar no ícone de download uma única vez → arquivo deve baixar.
- Para documentos com URL já decifrada (após reabrir a conversa), o clique também deve baixar imediatamente.
- Documentos com mídia expirada devem mostrar a mensagem "Mídia não disponível neste histórico" com botão "Tentar".
