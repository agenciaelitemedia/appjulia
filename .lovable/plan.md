

# Análise Completa do Chat — Problemas e Plano de Correção

## Problemas Identificados

### 1. Chat não suporta WABA (API Oficial)
O `WhatsAppDataContext` depende exclusivamente do `useUaZapi` para envio e busca de mensagens. Agentes com `hub === 'waba'` não conseguem usar o chat, pois não possuem `evo_url`/`evo_apikey` — o `isConfigured` fica `false` e nada funciona.

### 2. Falta de `cod_agent` no fluxo
O `loadContacts` filtra por `client_id` (user.id), mas o chat deveria também filtrar por `cod_agent` para separar conversas por agente. Atualmente o `ChatPage` chama `loadContacts()` sem `codAgent`, e não há seleção de agente no chat.

### 3. Tabelas vazias — sem sincronização automática
As tabelas `chat_contacts` e `chat_messages` têm 0 registros. Os dados chegam via webhooks (`uazapi-webhook` e `meta-webhook`) mas o chat não busca dados do `webhook_logs` como fallback. A sincronização manual (`syncContacts`) só funciona com UaZapi.

### 4. `onConflict: 'message_id'` inválido
Na linha 301 do contexto, o upsert de mensagens usa `onConflict: 'message_id'`, mas `message_id` não tem constraint UNIQUE na tabela `chat_messages`. Isso causa erro silencioso.

### 5. Envio de mídia incompleto
- `sendMedia` converte para base64 mas não faz optimistic update (mensagem não aparece na tela durante envio)
- Não salva a mensagem de mídia no Supabase após envio
- `handleDownload` no `MediaContent` está comentado (linhas 84-86 do MessageBubble)

### 6. Realtime duplica mensagens
O canal realtime de INSERT em `chat_messages` adiciona mensagens ao state, mas o `sendMessage` já faz optimistic update + save. Quando a mensagem é salva no Supabase, o realtime a adiciona novamente → mensagem duplicada.

### 7. Botões do header não funcionam
- "Chamada de voz" e "Chamada de vídeo" no `ChatHeader` não fazem nada
- "Ver detalhes", "Arquivar", "Silenciar", "Excluir" não têm handlers implementados

### 8. Gravação de áudio desabilitada
O botão de mic no `ChatInput` está `disabled` com tooltip "em breve"

### 9. `formatWhatsAppText` com bug de regex
A regex de URL usa `test()` após `split()` — isso reseta `lastIndex` do regex global, causando detecção intermitente de links.

### 10. Audio player sem progresso
O player de áudio tem barra de progresso estática (`width: 0%`), nunca atualiza durante reprodução.

## Plano de Implementação

### Etapa 1: Seleção de agente no chat + suporte omnichannel

- Adicionar seletor de agente (dropdown com agentes do usuário) no topo do `ChatList`
- Armazenar `cod_agent` e `hub` selecionado no contexto
- `loadContacts` sempre filtrar por `cod_agent`
- Criar lógica condicional: se `hub === 'uazapi'` → usar UaZapi endpoints; se `hub === 'waba'` → usar edge function `waba-send`

**Arquivos**: `WhatsAppDataContext.tsx`, `ChatList.tsx`, `ChatPage.tsx`

### Etapa 2: Corrigir envio e recebimento de mensagens

- **Envio texto WABA**: chamar `supabase.functions.invoke('waba-send', { action: 'send_text', cod_agent, to, text })`
- **Envio mídia WABA**: chamar `waba-send` com action `send_media`
- **Envio mídia UaZapi**: adicionar optimistic update + salvar no Supabase após sucesso
- **Fix duplicação realtime**: no handler de INSERT, verificar se `message.id` já existe no state antes de adicionar

**Arquivos**: `WhatsAppDataContext.tsx`

### Etapa 3: Corrigir constraint e sincronização

- Migração SQL: adicionar `UNIQUE(contact_id, external_id)` ou `UNIQUE(message_id)` na tabela `chat_messages`
- **Sync WABA**: buscar mensagens de `chat_messages` (já persistidas pelo webhook) em vez de API
- **Sync UaZapi**: manter lógica atual mas corrigir upsert

**Arquivo**: Migração SQL, `WhatsAppDataContext.tsx`

### Etapa 4: Corrigir componentes de UI

- **Audio player**: adicionar `onTimeUpdate` ao `<audio>` para atualizar barra de progresso
- **Download de mídia**: implementar `handleDownload` real usando `message.download()` (UaZapi) ou buscar de Storage (WABA)
- **formatWhatsAppText**: criar nova instância de regex sem flag `g` ou usar `match` sem `test`
- **Desabilitar botões sem ação**: remover botões de chamada do header ou integrar com telefonia existente

**Arquivos**: `MessageBubble.tsx`, `ChatHeader.tsx`

### Etapa 5: Melhorias de UX

- Passar `onDownloadMedia` real do contexto para `ChatMessages` → `MessageBubble`
- Mostrar preview de mídia durante envio (optimistic com URL.createObjectURL)
- Status da conexão do agente visível no chat

## Arquivos alterados/criados

| Arquivo | Mudança |
|---|---|
| Migração SQL | UNIQUE constraint em `chat_messages.message_id` |
| `src/contexts/WhatsAppDataContext.tsx` | Seletor de agente, suporte WABA, fix duplicação, fix upsert, optimistic media |
| `src/components/chat/ChatList.tsx` | Dropdown de seleção de agente |
| `src/components/chat/ChatPage.tsx` | Passar agentes disponíveis |
| `src/components/chat/MessageBubble.tsx` | Fix audio player, fix download, fix formatWhatsAppText |
| `src/components/chat/ChatHeader.tsx` | Remover/desabilitar botões sem funcionalidade |
| `src/components/chat/ChatMessages.tsx` | Passar onDownloadMedia |

