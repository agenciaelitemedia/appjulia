## Problema

Ao enviar mídia pelo chat com legenda (digitada ou via mensagem rápida), a legenda aparece visualmente como caption na bolha otimista, mas **não chega no WhatsApp do destinatário**.

## Causa raiz

Em `src/contexts/WhatsAppDataContext.tsx`, dentro de `sendMedia`, o body enviado para o endpoint `POST /send/media` da UaZapi via `uazapi-proxy` inclui apenas o campo `caption`. A UaZapi, porém, espera o caption no campo **`text`** — `caption` é silenciosamente ignorado pela API.

Mesmo problema, secundário, no helper compartilhado `supabase/functions/_shared/uazapi-adapter.ts` (`sendMedia`), que também só envia `caption`.

WABA já está correto (`caption` é o campo oficial da Graph API).

## Correção

### 1. `src/contexts/WhatsAppDataContext.tsx` (ramo UaZapi do `sendMedia`)
Adicionar `text: caption` no body do `/send/media` (manter `caption` por compatibilidade defensiva). Para `ptt`/`audio`, **não** enviar `text` (UaZapi rejeita caption em áudio).

```ts
body: {
  number: target,
  file: fileField,
  mediaUrl: persistedUrl,
  type: mediaType,
  mediaType,
  mimetype: sendMimetype,
  text: isAudioMessage ? undefined : (caption || undefined),  // ← novo (campo correto na UaZapi)
  caption,                                                     // mantido por compat
  fileName: outboundFile.name,
  docName: type === 'document' ? outboundFile.name : undefined,
  ptt: type === 'ptt' ? true : undefined,
  forward: options?.forward === true ? true : undefined,
},
```

### 2. `supabase/functions/_shared/uazapi-adapter.ts` (`sendMedia`)
Mesmo ajuste no adapter compartilhado:

```ts
'/send/media', {
  number, mediaUrl, mediaType: type,
  text: type === 'audio' ? undefined : (caption || ''),  // ← novo
  caption: caption || '',                                 // mantido por compat
}
```

## Fora de escopo

- WABA continua intacto (já usa `caption` corretamente).
- Áudio (ptt/audio) continua sem caption — restrição da UaZapi e da WABA.
- Nenhuma mudança na UI; o fluxo de quick messages → `pendingMedia` → preview com caption editável segue igual.

## Validação

Após implementar:
1. No `/chat`, anexar imagem + digitar caption → enviar → conferir no WhatsApp do destinatário que a legenda chega.
2. Repetir via `/mensagens-rapidas` com mídia + texto adicional digitado.
3. Áudio gravado: não deve enviar caption (não regredir).