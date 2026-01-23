
# Plano: Corrigir Parsing de Mensagens WhatsApp

## Problema Identificado

Todas as mensagens aparecem como "[Mensagem nao suportada]" porque a funcao `detectMessageType` esta retornando `'unknown'` para todas. Isso indica que a estrutura real retornada pela UaZapi e diferente do esperado.

O codigo atual espera o padrao Baileys:
```
msg.message.conversation       -> texto
msg.message.imageMessage.url   -> imagem
```

Porem a UaZapi pode estar retornando outra estrutura. Precisamos adicionar logs detalhados para descobrir o formato real.

---

## Correcoes Necessarias

### 1. Adicionar Logs de Debug Detalhados

Na funcao `loadMessages`, logo apos receber as mensagens, logar a estrutura completa de pelo menos uma mensagem para identificar o formato:

```typescript
if (messagesArray.length > 0) {
  // Log da estrutura completa da primeira mensagem para debug
  console.log('🔬 [WhatsApp API] First message structure:', 
    JSON.stringify(messagesArray[0], null, 2)
  );
  console.log('🔬 [WhatsApp API] Message keys:', 
    Object.keys(messagesArray[0])
  );
  if (messagesArray[0].message) {
    console.log('🔬 [WhatsApp API] msg.message keys:', 
      Object.keys(messagesArray[0].message)
    );
  }
}
```

### 2. Expandir Deteccao de Tipos

Adicionar verificacoes para formatos alternativos que a UaZapi pode usar:

```typescript
function detectMessageType(message: any): MessageType {
  if (!message || typeof message !== 'object') return 'unknown';
  
  // Formato Baileys padrao
  if (message.conversation || message.extendedTextMessage) return 'text';
  if (message.imageMessage) return 'image';
  if (message.audioMessage) return 'audio';
  if (message.videoMessage) return 'video';
  if (message.documentMessage || message.documentWithCaptionMessage) return 'document';
  if (message.stickerMessage) return 'sticker';
  if (message.locationMessage) return 'location';
  if (message.contactMessage || message.contactsArrayMessage) return 'contact';
  
  // Formato alternativo UaZapi - verificar campo 'type' direto
  if (message.type) {
    const typeMap: Record<string, MessageType> = {
      'text': 'text',
      'chat': 'text',
      'image': 'image',
      'audio': 'audio',
      'ptt': 'audio',
      'video': 'video',
      'document': 'document',
      'sticker': 'sticker',
      'location': 'location',
      'vcard': 'contact',
      'contact': 'contact',
    };
    return typeMap[message.type] || 'unknown';
  }
  
  // Verificar se texto esta em 'body' ou 'text' direto
  if (message.body || message.text) return 'text';
  
  return 'unknown';
}
```

### 3. Expandir Extracao de Dados

Adicionar suporte para formato alternativo na funcao `extractMediaData`:

```typescript
case 'text':
  return {
    text: message.conversation 
       || message.extendedTextMessage?.text 
       || message.body 
       || message.text 
       || '',
  };
```

### 4. Verificar Estrutura Raiz

Alguns endpoints retornam o conteudo na raiz do objeto, nao em `msg.message`. Ajustar para tentar ambos:

```typescript
const formattedMessages: Message[] = messagesArray.map((msg: any) => {
  // Tentar pegar de msg.message (Baileys) ou direto de msg
  const messageContent = msg.message || msg;
  const messageType = detectMessageType(messageContent);
  // ...
});
```

---

## Arquivo a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/crm/components/WhatsAppMessagesDialog.tsx` | Adicionar logs detalhados e expandir parsing |

---

## Ordem de Implementacao

1. Adicionar logs de debug para ver estrutura exata da resposta
2. Atualizar `detectMessageType` para suportar formatos alternativos
3. Atualizar `extractMediaData` para extrair dados de formatos alternativos  
4. Ajustar mapeamento na funcao `loadMessages`

---

## Resultado Esperado

Apos a correcao, as mensagens serao corretamente identificadas e exibidas conforme seu tipo (texto, imagem, audio, etc.), independente de a UaZapi usar formato Baileys padrao ou um formato proprio.
