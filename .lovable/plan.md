
# Plano: Corrigir Visualizacao de Imagens e Videos

## Problema Identificado

Apos analise detalhada das respostas da API e dos logs de rede, identifiquei que:

1. **A API UaZapi retorna `fileURL: ""` (string vazia)** para mensagens de midia - isso significa que a URL do arquivo nao esta sendo retornada diretamente na resposta de `/message/find`

2. **O campo `thumbnail` contem dados base64** que podem ser usados para exibir uma previa da imagem/video

3. **Alerta de acessibilidade do Dialog** - Warning sobre `Description` ausente

---

## Causa Raiz

A UaZapi/Evolution API armazena metadados das mensagens de midia, mas o arquivo real pode:
- Precisar ser baixado separadamente via endpoint como `/media/download`
- Ter URL temporaria que expira
- Estar apenas armazenado como thumbnail base64

**Solucao:** Utilizar o `thumbnail` base64 quando `fileURL` estiver vazio, e adicionar endpoint para download de midia quando necessario.

---

## Correcoes Necessarias

### 1. Usar Thumbnail como Fallback para Imagens

Quando `mediaUrl` estiver vazio mas `thumbnail` existir:

```typescript
case 'image':
  return (
    <div className="space-y-1">
      {message.mediaUrl || message.thumbnail ? (
        <div className="relative max-w-[330px] overflow-hidden rounded-lg">
          <img 
            src={message.mediaUrl || (message.thumbnail ? `data:image/jpeg;base64,${message.thumbnail}` : '')}
            alt="Imagem" 
            className="w-full h-auto max-h-[400px] object-contain cursor-pointer rounded-lg"
            onClick={() => message.mediaUrl && window.open(message.mediaUrl, '_blank')}
            onError={(e) => {
              e.currentTarget.parentElement?.classList.add('hidden');
              e.currentTarget.parentElement?.nextElementSibling?.classList.remove('hidden');
            }}
          />
        </div>
      ) : null}
      <div className={cn(
        "flex items-center gap-2 p-3 rounded-lg bg-muted/50", 
        (message.mediaUrl || message.thumbnail) ? "hidden" : ""
      )}>
        <ImageIcon className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Imagem nao disponivel</span>
      </div>
      {message.caption && (
        <p className="text-sm whitespace-pre-wrap break-words mt-1">
          {renderTextWithLinks(message.caption)}
        </p>
      )}
    </div>
  );
```

### 2. Usar Thumbnail como Poster e Fallback para Videos

Quando video nao tiver `mediaUrl`, exibir thumbnail:

```typescript
case 'video':
  return (
    <div className="space-y-1">
      {message.mediaUrl ? (
        <div className="relative max-w-[330px] overflow-hidden rounded-lg">
          <video 
            controls 
            src={message.mediaUrl} 
            className="w-full h-auto max-h-[400px] object-contain rounded-lg"
            preload="metadata"
            poster={message.thumbnail ? `data:image/jpeg;base64,${message.thumbnail}` : undefined}
          />
        </div>
      ) : message.thumbnail ? (
        // Mostrar thumbnail com icone de play quando video nao disponivel
        <div className="relative max-w-[330px] overflow-hidden rounded-lg cursor-pointer">
          <img 
            src={`data:image/jpeg;base64,${message.thumbnail}`}
            alt="Video thumbnail" 
            className="w-full h-auto max-h-[400px] object-contain rounded-lg opacity-80"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center">
              <Play className="h-7 w-7 text-white fill-white ml-1" />
            </div>
          </div>
          <span className="absolute bottom-2 left-2 text-xs text-white bg-black/50 px-2 py-1 rounded">
            Video - clique para baixar
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
```

### 3. Corrigir Warning de Acessibilidade do Dialog

A `DialogDescription` ja existe mas com `sr-only`. Alterar para resolver o warning:

```typescript
<DialogDescription className="text-xs text-muted-foreground">
  Conversa do WhatsApp com {leadName || whatsappNumber}
</DialogDescription>
```

Ou adicionar `aria-describedby={undefined}` no DialogContent:

```typescript
<DialogContent 
  className="sm:max-w-[500px] h-[600px] flex flex-col p-0"
  aria-describedby={undefined}
>
```

### 4. Corrigir QuotedMessage com forwardRef

Adicionar forwardRef ao componente QuotedMessage:

```typescript
const QuotedMessage = React.forwardRef<
  HTMLDivElement,
  { text?: string; participant?: string; isFromMe: boolean }
>(({ text, participant, isFromMe }, ref) => {
  if (!text) return null;
  
  return (
    <div ref={ref} className={cn(...)}>
      {/* ... conteudo existente ... */}
    </div>
  );
});
QuotedMessage.displayName = 'QuotedMessage';
```

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/crm/components/WhatsAppMessagesDialog.tsx` | Usar thumbnail como fallback, corrigir acessibilidade e forwardRef |

---

## Resultado Esperado

- Imagens mostrarao o thumbnail base64 quando `fileURL` estiver vazio
- Videos mostrarao o thumbnail com icone de play quando URL nao disponivel
- Sem warnings de acessibilidade no console
- Sem warning de forwardRef no componente QuotedMessage
- Melhor experiencia visual mesmo com midias nao totalmente disponiveis
