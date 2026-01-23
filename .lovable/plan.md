
# Plano: Corrigir Visualizacao de Imagens e Videos estilo WhatsApp

## Problemas Atuais

| Elemento | Problema | WhatsApp Real |
|----------|----------|---------------|
| Imagem | `max-h-[200px]` muito pequeno, `object-cover` corta imagem | Largura max ~330px, altura proporcional, cantos arredondados |
| Video | `max-h-[200px]` pequeno, controles nativos simples | Thumbnail com play centralizado, cantos arredondados |
| Container | Sem sombra ou borda sutil | Borda sutil e sombra leve |

---

## Solucao

### 1. Atualizar Renderizacao de Imagens (linhas 444-467)

```typescript
case 'image':
  return (
    <div className="space-y-1">
      {message.mediaUrl ? (
        <div className="relative max-w-[330px] overflow-hidden rounded-lg">
          <img 
            src={message.mediaUrl} 
            alt="Imagem" 
            className="w-full h-auto max-h-[400px] object-contain cursor-pointer rounded-lg"
            onClick={() => window.open(message.mediaUrl, '_blank')}
            onError={(e) => {
              e.currentTarget.parentElement?.classList.add('hidden');
              e.currentTarget.parentElement?.nextElementSibling?.classList.remove('hidden');
            }}
          />
        </div>
      ) : null}
      <div className={cn(
        "flex items-center gap-2 p-3 rounded-lg bg-muted/50", 
        message.mediaUrl ? "hidden" : ""
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

**Mudancas:**
- Container com `max-w-[330px]` similar ao WhatsApp
- Imagem com `max-h-[400px]` para altura adequada
- `object-contain` para nao cortar imagens
- `rounded-lg` para cantos arredondados
- Container relativo para posicionamento futuro de overlays

### 2. Atualizar Renderizacao de Videos (linhas 495-515)

```typescript
case 'video':
  return (
    <div className="space-y-1">
      {message.mediaUrl ? (
        <div className="relative max-w-[330px] overflow-hidden rounded-lg group">
          <video 
            controls 
            src={message.mediaUrl} 
            className="w-full h-auto max-h-[400px] object-contain rounded-lg"
            preload="metadata"
            poster={message.thumbnail ? `data:image/jpeg;base64,${message.thumbnail}` : undefined}
          />
          {/* Play overlay para visual WhatsApp - aparece antes do play */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none opacity-0 group-hover:opacity-0">
            <div className="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center">
              <Play className="h-7 w-7 text-white fill-white ml-1" />
            </div>
          </div>
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

**Mudancas:**
- Container com `max-w-[330px]` igual imagens
- Video com `max-h-[400px]` para altura adequada
- `object-contain` para proporcoes corretas
- Suporte a `poster` com thumbnail base64
- `rounded-lg` consistente
- Container `group` para efeitos hover futuros

### 3. Atualizar Stickers (linhas 541-552)

```typescript
case 'sticker':
  return (
    <img 
      src={message.mediaUrl} 
      alt="Sticker" 
      className="max-w-[150px] max-h-[150px] object-contain"
      onError={(e) => {
        const parent = e.currentTarget.parentElement;
        if (parent) {
          parent.innerHTML = '<span class="text-muted-foreground text-sm">[Sticker]</span>';
        }
      }}
    />
  );
```

---

## Resumo das Dimensoes (estilo WhatsApp)

| Tipo | Largura Max | Altura Max | Object Fit |
|------|-------------|------------|------------|
| Imagem | 330px | 400px | contain |
| Video | 330px | 400px | contain |
| Sticker | 150px | 150px | contain |

---

## Arquivo a Modificar

| Arquivo | Secao |
|---------|-------|
| `src/pages/crm/components/WhatsAppMessagesDialog.tsx` | `MessageBubble` - cases image, video, sticker |

---

## Resultado Esperado

- Imagens exibidas em tamanho adequado sem cortes
- Videos com proporcoes corretas e thumbnail quando disponivel
- Visual consistente com a interface do WhatsApp
- Cantos arredondados em todas as midias
- Melhor experiencia ao visualizar conversas com fotos e videos
