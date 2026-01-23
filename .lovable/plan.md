
# Plano: Corrigir Endpoint de Busca de Mensagens WhatsApp

## Problema Identificado

O codigo atual esta usando o endpoint incorreto:
- **Atual (incorreto)**: `POST /chat/findMessages/{instance}` com body `{ where: { key: { remoteJid } }, limit }`
- **Correto**: `POST /message/find` com body `{ chatid, limit, offset }`

Isso explica o erro 405 (Method Not Allowed) nos logs.

---

## Correcao Necessaria

### Arquivo: `src/pages/crm/components/WhatsAppMessagesDialog.tsx`

**Alteracoes na funcao `loadMessages`:**

| Item | Antes | Depois |
|------|-------|--------|
| Endpoint | `/chat/findMessages/${instance}` | `/message/find` |
| Campo do chat | `where.key.remoteJid` | `chatid` |
| Paginacao | Apenas `limit` | `limit` + `offset` |

### Codigo Corrigido

```typescript
const loadMessages = async () => {
  if (!client || !isConfigured) return;

  setLoading(true);
  try {
    const jid = formatToJid(whatsappNumber);
    
    // Endpoint correto conforme documentacao
    const endpoint = '/message/find';
    const fullUrl = `${client.baseUrl}${endpoint}`;
    const requestBody = {
      chatid: jid,
      limit: 50,
      offset: 0,
    };
    
    console.log('[WhatsApp API] Loading messages:', {
      baseUrl: client.baseUrl,
      endpoint,
      fullUrl,
      requestBody,
    });
      
    const response = await client.post<Message[]>(endpoint, requestBody);
    
    // Processar resposta (array direto ou dentro de objeto)
    const messagesArray = Array.isArray(response) ? response : response.messages || [];
    
    // ... resto do processamento
  } catch (error) {
    // tratamento de erro
  }
};
```

---

## Resumo das Mudancas

1. Alterar endpoint de `/chat/findMessages/{instance}` para `/message/find`
2. Mudar estrutura do body de `{ where: { key: { remoteJid } } }` para `{ chatid }`
3. Adicionar campo `offset: 0` para paginacao
4. Ajustar parsing da resposta (pode vir como array direto)
5. Atualizar logs de debug com novo formato
