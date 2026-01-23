

# Plano: Implementar Download de Midia via API e Corrigir Warnings

## Problema Identificado

1. **API retorna `fileURL: ""`** - A API UaZapi retorna URLs vazias para midias, mas fornece o endpoint `/message/download` para baixar o arquivo real

2. **Warning de forwardRef persiste** - O console ainda mostra warning porque `MessageBubble` nao usa forwardRef e esta sendo usado dentro do Dialog

3. **Thumbnails funcionam** - O thumbnail base64 esta sendo usado como fallback, mas nao mostra a imagem em resolucao completa

---

## Solucao Completa

### 1. Adicionar Endpoint de Download no Cliente UaZapi

Criar tipos e adicionar o endpoint `/message/download` ao arquivo de endpoints:

```typescript
// Em src/lib/uazapi/types.ts
export interface DownloadMediaRequest {
  id: string;
  return_base64?: boolean;
  generate_mp3?: boolean;
  return_link?: boolean;
  transcribe?: boolean;
  openai_apikey?: string;
  download_quoted?: boolean;
}

export interface DownloadMediaResponse {
  fileURL?: string;
  mimetype?: string;
  base64Data?: string;
  transcription?: string;
}
```

```typescript
// Em src/lib/uazapi/endpoints/message.ts
download: (data: DownloadMediaRequest) => Promise<DownloadMediaResponse>;

async download(data: DownloadMediaRequest): Promise<DownloadMediaResponse> {
  return assertClient().post<DownloadMediaResponse>('/message/download', data);
}
```

### 2. Adicionar Estado de Loading e Download por Mensagem

No `WhatsAppMessagesDialog.tsx`, adicionar state para controlar quais midias estao sendo baixadas:

```typescript
const [downloadingMedia, setDownloadingMedia] = useState<Set<string>>(new Set());
const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});

const downloadMedia = async (messageId: string) => {
  if (!client || downloadingMedia.has(messageId)) return;
  
  setDownloadingMedia(prev => new Set(prev).add(messageId));
  
  try {
    const response = await client.post<DownloadMediaResponse>('/message/download', {
      id: messageId,
      return_link: true,
      return_base64: false,
    });
    
    if (response.fileURL) {
      setMediaUrls(prev => ({ ...prev, [messageId]: response.fileURL! }));
    }
  } catch (error) {
    console.error('Error downloading media:', error);
  } finally {
    setDownloadingMedia(prev => {
      const next = new Set(prev);
      next.delete(messageId);
      return next;
    });
  }
};
```

### 3. Atualizar MessageBubble com forwardRef e Download

```typescript
const MessageBubble = React.forwardRef<
  HTMLDivElement,
  { 
    message: Message;
    onDownload?: (messageId: string) => void;
    isDownloading?: boolean;
    downloadedUrl?: string;
  }
>(({ message, onDownload, isDownloading, downloadedUrl }, ref) => {
  const isFromMe = message.fromMe;
  
  // Para imagens: usar downloadedUrl > mediaUrl > thumbnail
  const effectiveMediaUrl = downloadedUrl || message.mediaUrl;
  
  // Auto-download quando montar se nao tem URL
  useEffect(() => {
    if (!effectiveMediaUrl && message.thumbnail && onDownload) {
      onDownload(message.id);
    }
  }, []);
  
  // ... resto do componente
});
MessageBubble.displayName = 'MessageBubble';
```

### 4. Atualizar Renderizacao de Imagens

```typescript
case 'image': {
  const imageUrl = downloadedUrl || message.mediaUrl;
  const showThumbnail = !imageUrl && message.thumbnail;
  
  return (
    <div className="space-y-1">
      {imageUrl ? (
        <div className="relative max-w-[330px] overflow-hidden rounded-lg">
          <img 
            src={imageUrl}
            alt="Imagem" 
            className="w-full h-auto max-h-[400px] object-contain cursor-pointer rounded-lg"
            onClick={() => window.open(imageUrl, '_blank')}
          />
        </div>
      ) : showThumbnail ? (
        <div className="relative max-w-[330px] overflow-hidden rounded-lg">
          <img 
            src={`data:image/jpeg;base64,${message.thumbnail}`}
            alt="Imagem (preview)" 
            className="w-full h-auto max-h-[400px] object-contain rounded-lg opacity-80"
          />
          {isDownloading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Loader2 className="h-8 w-8 text-white animate-spin" />
            </div>
          ) : (
            <div 
              className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer"
              onClick={() => onDownload?.(message.id)}
            >
              <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
                <Download className="h-6 w-6 text-white" />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
          <ImageIcon className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Imagem nao disponivel</span>
        </div>
      )}
      {message.caption && (
        <p className="text-sm whitespace-pre-wrap break-words mt-1">
          {renderTextWithLinks(message.caption)}
        </p>
      )}
    </div>
  );
}
```

### 5. Atualizar Renderizacao de Videos

```typescript
case 'video': {
  const videoUrl = downloadedUrl || message.mediaUrl;
  const showThumbnail = !videoUrl && message.thumbnail;
  
  return (
    <div className="space-y-1">
      {videoUrl ? (
        <div className="relative max-w-[330px] overflow-hidden rounded-lg">
          <video 
            controls 
            src={videoUrl} 
            className="w-full h-auto max-h-[400px] object-contain rounded-lg"
            preload="metadata"
            poster={message.thumbnail ? `data:image/jpeg;base64,${message.thumbnail}` : undefined}
          />
        </div>
      ) : showThumbnail ? (
        <div 
          className="relative max-w-[330px] overflow-hidden rounded-lg cursor-pointer"
          onClick={() => !isDownloading && onDownload?.(message.id)}
        >
          <img 
            src={`data:image/jpeg;base64,${message.thumbnail}`}
            alt="Video thumbnail" 
            className="w-full h-auto max-h-[400px] object-contain rounded-lg opacity-80"
          />
          {isDownloading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Loader2 className="h-8 w-8 text-white animate-spin" />
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center">
                <Play className="h-7 w-7 text-white fill-white ml-1" />
              </div>
            </div>
          )}
          <span className="absolute bottom-2 left-2 text-xs text-white bg-black/50 px-2 py-1 rounded">
            {isDownloading ? 'Baixando...' : 'Clique para baixar'}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg max-w-[330px]">
          <Video className="h-6 w-6 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Video nao disponivel</span>
        </div>
      )}
      {message.caption && (
        <p className="text-sm whitespace-pre-wrap break-words mt-1">
          {renderTextWithLinks(message.caption)}
        </p>
      )}
    </div>
  );
}
```

### 6. Atualizar Lista de Mensagens

Passar as novas props para cada MessageBubble:

```typescript
{messages.map((msg, index) => (
  <MessageBubble 
    key={msg.id} 
    ref={null}
    message={msg}
    onDownload={downloadMedia}
    isDownloading={downloadingMedia.has(msg.id)}
    downloadedUrl={mediaUrls[msg.id]}
  />
))}
```

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/lib/uazapi/types.ts` | Adicionar tipos `DownloadMediaRequest` e `DownloadMediaResponse` |
| `src/lib/uazapi/endpoints/message.ts` | Adicionar metodo `download` |
| `src/pages/crm/components/WhatsAppMessagesDialog.tsx` | Implementar download de midia, forwardRef no MessageBubble, UI com loading |

---

## Fluxo de Funcionamento

```text
1. Mensagem carregada com fileURL vazio
   |
2. Exibe thumbnail base64 com botao de download
   |
3. Usuario clica ou auto-download inicia
   |
4. POST /message/download { id: msgId, return_link: true }
   |
5. API retorna { fileURL: "https://..." }
   |
6. Atualiza mediaUrls[msgId] = response.fileURL
   |
7. Imagem/video renderiza com URL completa
```

---

## Resultado Esperado

- Imagens e videos carregarao automaticamente via endpoint `/message/download`
- Thumbnail exibido enquanto download esta em progresso
- Indicador de loading durante download
- Sem warnings de forwardRef no console
- Clique para abrir midia em tela cheia quando disponivel
- Fallback visual quando midia nao esta disponivel

