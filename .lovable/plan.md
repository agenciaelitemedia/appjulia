

## Plano: Ajustar Chat para Funcionar como WhatsApp + Corrigir Webhook

### Problemas Identificados

1. **Webhook não processa mensagens**: O payload da UaZapi usa campos como `msg.from` e `msg.text.body`, mas o webhook busca `msg.sender_pn`, `msg.PhoneNumber`, `msg.phone` e `msg.text` (como string). Resultado: `senderPhone` fica vazio e todas as mensagens são ignoradas (`processed: 0`).

2. **Lista de contatos não parece com WhatsApp**: Usa `formatDistanceToNow` ("há 2 min") em vez do padrão WhatsApp (HH:mm hoje, "Ontem", dd/MM para mais antigo).

3. **`last_message_text` é null** para contatos sincronizados via `/chat/find` — a syncContacts não preenche esse campo corretamente.

4. **Ordenação da lista**: Já ordena por `last_message_at` DESC, mas precisa re-ordenar no frontend quando novas mensagens chegam via realtime.

5. **Scroll infinito no ChatMessages**: O `onScrollCapture` no `ScrollArea` pode não disparar corretamente; o carregamento automático ao subir precisa ser mais robusto.

6. **Mídia não renderiza**: O webhook não está salvando mensagens, então nenhuma mídia chega. Além disso, a extração de media_url precisa considerar o formato correto do payload.

---

### Correções

#### 1. Corrigir `uazapi-chat-webhook/index.ts` — Extração de Dados

**Problema crítico**: O webhook ignora todas as mensagens porque não encontra o telefone do remetente.

- `extractMessageText`: Adicionar suporte para `msg.text?.body` (formato UaZapi real) além de `msg.text` (string)
- `senderPhone`: Adicionar `msg.from` à lista de campos verificados (é o campo principal no payload real)
- `extractMediaUrl`: Adicionar `msg.mediaUrl` e `msg.media?.url` como campos alternativos
- `chatId`: Adicionar `msg.from` como fallback para o remoteJid (formato `55xxx@s.whatsapp.net`)

```typescript
// ANTES (falha)
function extractMessageText(msg: any): string | undefined {
  if (msg.text) return msg.text; // msg.text é {body: "..."}, não string!
  ...
}

// DEPOIS (correto)
function extractMessageText(msg: any): string | undefined {
  if (typeof msg.text === 'string') return msg.text;
  if (msg.text?.body) return msg.text.body;
  ...
}

// ANTES (falha)
const senderPhone = normalizePhone(
  msg.sender_pn || msg.PhoneNumber || msg.phone || chatId || ''
);

// DEPOIS (correto)
const senderPhone = normalizePhone(
  msg.from || msg.sender_pn || msg.PhoneNumber || msg.phone || chatId || ''
);
```

#### 2. Refatorar `ChatContactItem.tsx` — Formato WhatsApp

Substituir `formatDistanceToNow` por formato WhatsApp:
- **Hoje**: `HH:mm` (ex: "14:30")
- **Ontem**: "Ontem"
- **Esta semana**: Dia da semana (ex: "Terça")
- **Mais antigo**: `dd/MM/yyyy`

Exibir preview da última mensagem com ícones por tipo:
- 📷 para imagem, 🎥 vídeo, 🎤 áudio, 📄 documento

#### 3. Refatorar `ChatList.tsx` — Ordenação Dinâmica

Garantir que `filteredContacts` é reordenado por `last_message_at` DESC no `useMemo`, para que contatos com mensagens novas (via realtime) subam ao topo automaticamente.

#### 4. Melhorar `ChatMessages.tsx` — Scroll Infinito Robusto

- Usar `IntersectionObserver` no topo da lista em vez de `onScrollCapture` no `ScrollArea` (que pode não disparar corretamente)
- Preservar posição do scroll ao carregar mensagens antigas (salvar `scrollHeight` antes, restaurar depois)
- Auto-scroll para o final apenas em mensagens novas quando já estiver perto do final

#### 5. Atualizar `WhatsAppDataContext.tsx` — Reordenar Contatos no Realtime

No handler de `chat_contacts` UPDATE via realtime, reordenar a lista de contatos por `last_message_at` para que o contato com nova mensagem suba ao topo.

#### 6. Corrigir `syncContacts` — Preencher `last_message_text`

Na sincronização, buscar `wa_lastMessage` ou `wa_lastMessageContent` do objeto retornado pela API e salvar em `last_message_text`.

---

### Arquivos

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/uazapi-chat-webhook/index.ts` | Corrigir extração de phone, text e media |
| `src/components/chat/ChatContactItem.tsx` | Formato de hora estilo WhatsApp |
| `src/components/chat/ChatList.tsx` | Ordenação dinâmica por mensagem recente |
| `src/components/chat/ChatMessages.tsx` | IntersectionObserver + preservar scroll |
| `src/contexts/WhatsAppDataContext.tsx` | Reordenar contatos no realtime, sync text |

