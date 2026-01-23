
# Plano: Corrigir Apresentacao de Videos e Imagens [object Object]

## Problema Identificado

A estrutura de resposta da UaZapi usa campos diferentes do formato Baileys padrao:

| Campo UaZapi | Descricao |
|--------------|-----------|
| `messageType` | Tipo: "ImageMessage", "VideoMessage", "ExtendedTextMessage" |
| `text` | Texto direto da mensagem |
| `content` | **Objeto** contendo `contextInfo` e possivelmente `text` |
| `fileURL` | URL do arquivo de midia |
| `content.caption` | Legenda da imagem/video |

O problema ocorre porque:
1. O codigo atual tenta usar `message.content` como string, mas e um objeto
2. Para imagens/videos, o codigo busca `imageMessage.url` mas deveria usar `fileURL`
3. A funcao `extractMediaData` nao reconhece o formato UaZapi

---

## Correcoes Necessarias

### 1. Corrigir `detectMessageType` para formato UaZapi

Adicionar deteccao baseada em `messageType` da UaZapi:

```typescript
// Formato UaZapi - verificar messageType
if (message.messageType) {
  const typeMap: Record<string, MessageType> = {
    'ExtendedTextMessage': 'text',
    'ImageMessage': 'image',
    'AudioMessage': 'audio',
    'VideoMessage': 'video',
    'DocumentMessage': 'document',
    'StickerMessage': 'sticker',
    'LocationMessage': 'location',
    'ContactMessage': 'contact',
    'conversation': 'text',
  };
  if (typeMap[message.messageType]) {
    return typeMap[message.messageType];
  }
}
```

### 2. Corrigir `extractMediaData` para formato UaZapi

Modificar cada case para suportar ambos os formatos:

**Texto:**
```typescript
case 'text':
  // Extrair texto de multiplas fontes possiveis
  let textContent = message.conversation 
    || message.extendedTextMessage?.text 
    || message.text                    // UaZapi direto
    || message.body;
  
  // Se content for objeto com campo text
  if (!textContent && message.content && typeof message.content === 'object') {
    textContent = message.content.text;
  } else if (!textContent && typeof message.content === 'string') {
    textContent = message.content;
  }
  
  return { text: textContent || '' };
```

**Imagem:**
```typescript
case 'image':
  // Suportar formato Baileys e UaZapi
  const imageUrl = message.imageMessage?.url || message.fileURL;
  const imageCaption = message.imageMessage?.caption 
    || message.content?.caption 
    || message.caption;
  const imageMime = message.imageMessage?.mimetype || message.mimetype;
  
  return {
    mediaUrl: imageUrl,
    caption: imageCaption,
    mimetype: imageMime,
    thumbnail: message.imageMessage?.jpegThumbnail || message.thumbnail,
    text: imageCaption || '[Imagem]',
  };
```

**Video:**
```typescript
case 'video':
  const videoUrl = message.videoMessage?.url || message.fileURL;
  const videoCaption = message.videoMessage?.caption 
    || message.content?.caption 
    || message.caption;
  
  return {
    mediaUrl: videoUrl,
    caption: videoCaption,
    mimetype: message.videoMessage?.mimetype || message.mimetype,
    seconds: message.videoMessage?.seconds || message.seconds,
    thumbnail: message.videoMessage?.jpegThumbnail || message.thumbnail,
    text: videoCaption || '[Video]',
  };
```

**Audio:**
```typescript
case 'audio':
  const audioUrl = message.audioMessage?.url || message.fileURL;
  
  return {
    mediaUrl: audioUrl,
    seconds: message.audioMessage?.seconds || message.seconds,
    ptt: message.audioMessage?.ptt ?? message.ptt ?? false,
    mimetype: message.audioMessage?.mimetype || message.mimetype,
    text: `[Audio ${formatDuration(message.audioMessage?.seconds || message.seconds)}]`,
  };
```

**Documento:**
```typescript
case 'document':
  const doc = message.documentMessage 
    || message.documentWithCaptionMessage?.message?.documentMessage;
  const docUrl = doc?.url || message.fileURL;
  const docName = doc?.fileName || doc?.title || message.fileName || message.title;
  
  return {
    mediaUrl: docUrl,
    fileName: docName,
    mimetype: doc?.mimetype || message.mimetype,
    caption: doc?.caption || message.caption,
    text: docName || '[Documento]',
  };
```

**Sticker:**
```typescript
case 'sticker':
  return {
    mediaUrl: message.stickerMessage?.url || message.fileURL,
    mimetype: message.stickerMessage?.mimetype || message.mimetype,
    text: '[Sticker]',
  };
```

### 3. Garantir que content nao seja convertido para string incorretamente

Na funcao `renderTextWithLinks`, ja foi corrigido, mas precisamos garantir que valores objetos nunca cheguem la:

```typescript
function extractMediaData(message: any, type: MessageType): Partial<Message> {
  // ...
  case 'text':
    let textContent = '';
    
    // Prioridade de extracao de texto
    if (message.conversation) {
      textContent = message.conversation;
    } else if (message.extendedTextMessage?.text) {
      textContent = message.extendedTextMessage.text;
    } else if (typeof message.text === 'string') {
      textContent = message.text;
    } else if (message.content?.text && typeof message.content.text === 'string') {
      textContent = message.content.text;
    } else if (typeof message.body === 'string') {
      textContent = message.body;
    }
    
    return { text: textContent };
```

---

## Arquivo a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/crm/components/WhatsAppMessagesDialog.tsx` | Atualizar `detectMessageType` e `extractMediaData` para suportar formato UaZapi |

---

## Ordem de Implementacao

1. Atualizar `detectMessageType` para reconhecer `messageType` da UaZapi (ImageMessage, VideoMessage, etc.)
2. Atualizar `extractMediaData` para cada tipo de midia, usando `fileURL` como fallback
3. Garantir que texto seja extraido corretamente de `content.text` quando content for objeto
4. Adicionar validacao de tipo antes de usar valores

---

## Resultado Esperado

Apos a correcao:
- Imagens serao exibidas corretamente com a URL de `fileURL`
- Videos serao reproduziveis com a URL de `fileURL`
- Textos dentro de `content.text` serao extraidos corretamente
- Legendas (captions) serao exibidas abaixo das midias
- Nenhum `[object Object]` aparecera na interface
