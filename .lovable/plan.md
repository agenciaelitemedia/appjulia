
# Plano: Renderizar Mensagens WhatsApp com Suporte a Midia

## Visao Geral

Atualizar o componente `WhatsAppMessagesDialog` para identificar e renderizar corretamente diferentes tipos de mensagem do WhatsApp: texto, imagem, audio, video, documento e sticker.

---

## Estrutura de Resposta da UaZapi

Baseado na documentacao da Evolution API, cada mensagem retorna um objeto com estrutura Baileys:

```text
+------------------+----------------------------------------+
| Tipo             | Propriedade no objeto `message`        |
+------------------+----------------------------------------+
| Texto simples    | conversation                           |
| Texto estendido  | extendedTextMessage.text               |
| Imagem           | imageMessage.url, .caption, .mimetype  |
| Audio            | audioMessage.url, .seconds, .ptt       |
| Video            | videoMessage.url, .caption, .mimetype  |
| Documento        | documentMessage.url, .fileName, .title |
| Sticker          | stickerMessage.url                     |
| Localizacao      | locationMessage.degreesLatitude, etc   |
| Contato          | contactMessage.displayName             |
+------------------+----------------------------------------+
```

---

## Alteracoes Planejadas

### 1. Atualizar Interface Message

Expandir a interface para incluir campos de midia:

```typescript
interface Message {
  id: string;
  text: string;
  fromMe: boolean;
  timestamp: number;
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'location' | 'contact' | 'unknown';
  mediaUrl?: string;
  mimetype?: string;
  caption?: string;
  fileName?: string;
  seconds?: number;      // duracao do audio
  ptt?: boolean;         // audio de voz (push-to-talk)
  thumbnail?: string;    // base64 thumbnail
}
```

### 2. Refatorar Parsing das Mensagens

Extrair dados de forma mais completa no `loadMessages`:

```typescript
const formattedMessages = messagesArray.map((msg: any) => {
  const message = msg.message || {};
  
  // Detectar tipo de mensagem
  const messageType = detectMessageType(message);
  
  // Extrair dados baseado no tipo
  const mediaData = extractMediaData(message, messageType);
  
  return {
    id: msg.key?.id || msg.id,
    type: messageType,
    text: mediaData.text,
    mediaUrl: mediaData.url,
    mimetype: mediaData.mimetype,
    caption: mediaData.caption,
    fileName: mediaData.fileName,
    seconds: mediaData.seconds,
    ptt: mediaData.ptt,
    fromMe: msg.key?.fromMe ?? false,
    timestamp: msg.messageTimestamp || Date.now() / 1000,
  };
});
```

### 3. Funcoes Auxiliares

**detectMessageType**: Identifica o tipo baseado nas chaves do objeto:

```typescript
function detectMessageType(message: any): Message['type'] {
  if (message.conversation || message.extendedTextMessage) return 'text';
  if (message.imageMessage) return 'image';
  if (message.audioMessage) return 'audio';
  if (message.videoMessage) return 'video';
  if (message.documentMessage) return 'document';
  if (message.stickerMessage) return 'sticker';
  if (message.locationMessage) return 'location';
  if (message.contactMessage || message.contactsArrayMessage) return 'contact';
  return 'unknown';
}
```

**extractMediaData**: Extrai URL e metadados da midia:

```typescript
function extractMediaData(message: any, type: string) {
  switch (type) {
    case 'text':
      return { 
        text: message.conversation || message.extendedTextMessage?.text 
      };
    case 'image':
      return {
        url: message.imageMessage?.url,
        caption: message.imageMessage?.caption,
        mimetype: message.imageMessage?.mimetype,
        text: message.imageMessage?.caption || '[Imagem]',
      };
    case 'audio':
      return {
        url: message.audioMessage?.url,
        seconds: message.audioMessage?.seconds,
        ptt: message.audioMessage?.ptt,
        mimetype: message.audioMessage?.mimetype,
        text: `[Audio ${formatDuration(message.audioMessage?.seconds)}]`,
      };
    // ... outros tipos
  }
}
```

### 4. Componente MessageBubble

Criar componente dedicado para renderizar cada tipo de mensagem:

```typescript
function MessageBubble({ message }: { message: Message }) {
  switch (message.type) {
    case 'text':
      return <TextMessage text={message.text} />;
      
    case 'image':
      return (
        <div className="space-y-1">
          <img 
            src={message.mediaUrl} 
            alt="Imagem" 
            className="max-w-full rounded-md cursor-pointer"
            onClick={() => window.open(message.mediaUrl)}
          />
          {message.caption && <p className="text-sm">{message.caption}</p>}
        </div>
      );
      
    case 'audio':
      return (
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4" />
          <audio controls src={message.mediaUrl} className="max-w-[200px]" />
          {message.seconds && (
            <span className="text-xs">{formatDuration(message.seconds)}</span>
          )}
        </div>
      );
      
    case 'video':
      return (
        <div className="space-y-1">
          <video 
            controls 
            src={message.mediaUrl} 
            className="max-w-full rounded-md"
          />
          {message.caption && <p className="text-sm">{message.caption}</p>}
        </div>
      );
      
    case 'document':
      return (
        <a 
          href={message.mediaUrl} 
          target="_blank"
          className="flex items-center gap-2 p-2 bg-background/50 rounded"
        >
          <FileText className="h-5 w-5" />
          <span className="text-sm truncate">{message.fileName || 'Documento'}</span>
          <Download className="h-4 w-4 ml-auto" />
        </a>
      );
      
    case 'sticker':
      return (
        <img 
          src={message.mediaUrl} 
          alt="Sticker" 
          className="max-w-[150px] max-h-[150px]"
        />
      );
      
    case 'location':
      return (
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          <span className="text-sm">Localizacao compartilhada</span>
        </div>
      );
      
    case 'contact':
      return (
        <div className="flex items-center gap-2">
          <User className="h-4 w-4" />
          <span className="text-sm">{message.text}</span>
        </div>
      );
      
    default:
      return <p className="text-sm italic">[Mensagem nao suportada]</p>;
  }
}
```

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/crm/components/WhatsAppMessagesDialog.tsx` | Refatorar interface, parsing e renderizacao |

---

## Icones Necessarios

Adicionar imports do Lucide:

```typescript
import { 
  MessageCircle, Send, Loader2,
  Mic, FileText, Download, MapPin, User, Play, Image as ImageIcon
} from 'lucide-react';
```

---

## Consideracoes Tecnicas

1. **URLs de Midia**: As URLs retornadas pela Evolution API podem expirar. Se isso ocorrer, pode ser necessario implementar um proxy ou cache

2. **Audio PTT**: Audios de voz (ptt=true) podem ter estilo diferente dos audios normais

3. **Thumbnails**: Para imagens e videos, a API pode retornar `jpegThumbnail` em base64 que pode ser usado como placeholder

4. **Fallback**: Sempre ter um fallback para tipos desconhecidos

5. **Seguranca**: URLs de midia externas devem ser tratadas com cuidado

---

## Resumo Visual do Fluxo

```text
API Response
     |
     v
+------------------+
| detectMessageType|  --> Identifica: text, image, audio, etc.
+------------------+
     |
     v
+------------------+
| extractMediaData |  --> Extrai: url, caption, fileName, etc.
+------------------+
     |
     v
+------------------+
| MessageBubble    |  --> Renderiza componente apropriado
+------------------+
     |
     v
   [UI]
   - Texto: <p>
   - Imagem: <img>
   - Audio: <audio>
   - Video: <video>
   - Documento: <a> com icone
   - Sticker: <img> pequeno
```
