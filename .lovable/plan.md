# Forçar download de mídias no chat

## Problema
Hoje os botões de "Download" no chat usam `<a href={url} download>` apontando diretamente para URLs cross-origin (UaZapi / storage). O atributo `download` é ignorado pelo browser quando a URL é de outra origem, então o link abre numa nova aba em vez de baixar o arquivo. Vídeos no preview não têm botão de download.

## Solução

Criar um helper `forceDownload(url, fileName)` que faz `fetch` da URL, converte para `Blob`, gera `URL.createObjectURL` e dispara um `<a>` virtual com `download={fileName}`. Isso garante download real (com fallback para nova aba se o fetch falhar por CORS).

Aplicar nos 3 pontos onde a mídia é apresentada/baixada.

## Arquivos a alterar

### 1. `src/lib/forceDownload.ts` (novo)
Função utilitária:
- Recebe `url` + `fileName` opcional
- `fetch(url) → blob → createObjectURL → click programático → revoke`
- Inferir `fileName` da URL quando não fornecido
- Em erro, fallback para abrir em nova aba

### 2. `src/components/chat/MediaLightbox.tsx`
- Substituir `<a href download>` por `<Button onClick={() => forceDownload(url, fileName)}>`

### 3. `src/components/chat/MessageBubble.tsx`

**Imagem** (case `'image'`):
- Adicionar botão flutuante de download no canto superior direito do preview (visível em hover), chamando `forceDownload(mediaUrl, file_name)`.

**Vídeo** (case `'video'`):
- Adicionar botão de download abaixo/sobreposto ao `<video>`, chamando `forceDownload`.

**Documento** (case `'document'`):
- Trocar `<a href={mediaUrl} target="_blank" download>` por `<Button onClick={() => forceDownload(mediaUrl, file_name)}>` — mantém o ícone `Download` atual.

## Comportamento esperado
- Imagem: ícone de download no preview, clique baixa o arquivo (não abre aba).
- Vídeo: player com controles + botão de download que baixa o arquivo.
- Documento: ícone de download já existente passa a baixar de fato.
- Lightbox: botão de download força salvamento.
