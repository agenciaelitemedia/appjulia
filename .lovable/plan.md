

# Plano: Corrigir Endpoints da UaZapi para Envio de Mensagens

## Problema Identificado

O erro `405 Method Not Allowed` ocorre porque os endpoints definidos na biblioteca UaZapi estão incorretos. A documentação oficial da UaZapi (https://docs.uazapi.com) mostra que os endpoints seguem o padrão `/send/...`, não `/message/...`.

**Endpoints atuais (incorretos):**
- `/message/text`
- `/message/image`
- `/message/video`
- `/message/audio`
- `/message/document`
- `/message/sticker`
- `/message/location`
- `/message/contact`
- `/message/buttons`
- `/message/list`

**Endpoints corretos da UaZapi:**
- `/send/text` - Enviar mensagem de texto
- `/send/media` - Enviar mídia (imagem, vídeo, áudio, documento, sticker)
- `/send/location` - Enviar localização
- `/send/contact` - Enviar contato (vCard)
- `/send/menu` - Enviar menus interativos (botões, lista, enquete)

## Arquivos a Modificar

### 1. `src/lib/uazapi/endpoints/message.ts`

Atualizar todos os endpoints de envio de mensagem:

| Método | Antes | Depois |
|--------|-------|--------|
| `sendText` | `/message/text` | `/send/text` |
| `sendImage` | `/message/image` | `/send/media` (com `type: 'image'`) |
| `sendVideo` | `/message/video` | `/send/media` (com `type: 'video'`) |
| `sendAudio` | `/message/audio` | `/send/media` (com `type: 'audio'`) |
| `sendDocument` | `/message/document` | `/send/media` (com `type: 'document'`) |
| `sendSticker` | `/message/sticker` | `/send/media` (com `type: 'sticker'`) |
| `sendLocation` | `/message/location` | `/send/location` |
| `sendContact` | `/message/contact` | `/send/contact` |
| `sendButtons` | `/message/buttons` | `/send/menu` |
| `sendList` | `/message/list` | `/send/menu` |

### 2. `src/pages/crm/components/WhatsAppMessagesDialog.tsx`

Atualizar a chamada de envio de mensagem de texto para usar o endpoint correto:

**Antes (linha ~1027):**
```typescript
await client.post('/message/text', {
  number: whatsappNumber.replace(/\D/g, ''),
  text: newMessage.trim(),
});
```

**Depois:**
```typescript
await client.post('/send/text', {
  number: whatsappNumber.replace(/\D/g, ''),
  text: newMessage.trim(),
});
```

## Detalhes Técnicos

### Parâmetros do endpoint `/send/text`

```typescript
interface SendTextRequest {
  number: string;      // Número em formato internacional (ex: "5511999999999")
  text: string;        // Texto da mensagem
  linkPreview?: boolean; // Ativar preview de links (opcional)
  replyid?: string;    // ID da mensagem para responder (opcional)
  delay?: number;      // Atraso em ms antes do envio (opcional)
  readchat?: boolean;  // Marcar conversa como lida (opcional)
}
```

### Parâmetros do endpoint `/send/media`

```typescript
interface SendMediaRequest {
  number: string;      // Número do destinatário
  type: 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'ptt';
  media: string;       // URL ou Base64 da mídia
  caption?: string;    // Legenda (opcional, para imagem/vídeo/documento)
  filename?: string;   // Nome do arquivo (para documentos)
}
```

## Impacto

- O envio de mensagens pelo popup do WhatsApp no CRM funcionará corretamente
- A biblioteca UaZapi ficará alinhada com a documentação oficial da API
- Futuros envios de mídia, localização e contatos também funcionarão corretamente

## Verificação

Após a implementação:
1. Abrir o popup de chat do WhatsApp no CRM
2. Enviar uma mensagem de texto
3. Verificar nos logs de rede que o endpoint chamado é `/send/text`
4. Confirmar que a resposta é 200 (sucesso) e a mensagem é enviada

