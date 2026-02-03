

# Plano: Sistema de Chat WhatsApp Completo

## Análise do Sistema de Referência (painel-helena)

Após analisar o repositório `painel-julia-php/painel-helena`, identifiquei as seguintes características:

### Resposta à sua pergunta: Trabalha direto com WhatsApp ou guarda em banco?

**O sistema usa AMBOS - híbrido:**

1. **Banco de dados local (Supabase)** para:
   - Armazenar contatos (`contacts`)
   - Armazenar mensagens (`messages`)
   - Gerenciar contadores de não lidas
   - Persistir histórico
   - Realtime via Postgres Changes

2. **UaZapi (direto do WhatsApp)** para:
   - Buscar mensagens novas (`syncNewMessages`)
   - Enviar mensagens (texto, mídia, localização)
   - Marcar como lido
   - Download de mídias pesadas

### Arquitetura do Chat no painel-helena

| Componente | Função |
|------------|--------|
| `WhatsAppDataContext` | Provider central que gerencia estado de contatos e mensagens |
| `Chat.tsx` | Página principal do chat |
| `ChatList.tsx` | Lista de conversas com busca e filtros |
| `ChatMessages.tsx` | Área de mensagens com scroll infinito |
| `ChatInput.tsx` | Input com emoji, anexos, gravação de áudio |
| `MessageBubble.tsx` | Renderização de cada mensagem |
| `ContactDetailsPanel.tsx` | Painel lateral com detalhes do contato |

### Funcionalidades Implementadas

- Lista de conversas com abas (Individual/Grupos)
- Contadores de não lidas
- Scroll infinito nas mensagens
- Envio de: texto, imagens, vídeos, documentos, áudio/PTT, localização
- Formatação WhatsApp (*negrito*, _itálico_, ~tachado~, `código`)
- Links clicáveis
- Responder mensagens (quote)
- Marcar como lido (individual e em massa)
- Sincronização com WhatsApp
- Realtime updates via Supabase

---

## Comparação com o Projeto Atual (Julia)

### O que já existe no projeto Julia:

| Componente | Status |
|------------|--------|
| `UaZapiContext` / `useUaZapi` | Existe - Provider com todos os endpoints |
| `UaZapiClient` | Existe - Cliente HTTP completo |
| `WhatsAppMessagesDialog` | Existe - Popup de mensagens no CRM (1230 linhas) |

### O que **NÃO existe** no projeto Julia:

| Componente | Status |
|------------|--------|
| Página de Chat dedicada (`/chat`) | Não existe |
| Tabela `contacts` no Supabase | Não existe (usa banco externo) |
| Tabela `messages` no Supabase | Não existe (usa banco externo) |
| `WhatsAppDataContext` | Não existe |
| Realtime para mensagens | Não existe |
| Download de mídias persistente | Parcial (sob demanda) |

### Diferença Arquitetural Chave:

- **painel-helena**: Usa **Supabase interno** para contacts/messages
- **Julia**: Usa **banco externo** (`externalDb`) para tudo relacionado a leads/agentes

---

## Plano de Implementação

### Fase 1: Infraestrutura de Dados (Backend)

Criar tabelas no Supabase para armazenar dados do chat:

1. **Tabela `chat_contacts`**:
   - `id` (uuid, PK)
   - `client_id` (uuid, FK profiles)
   - `cod_agent` (text) - vínculo com agente
   - `phone` (text)
   - `name` (text)
   - `avatar` (text, nullable)
   - `is_group` (boolean, default false)
   - `is_archived` (boolean, default false)
   - `is_muted` (boolean, default false)
   - `unread_count` (integer, default 0)
   - `last_message_at` (timestamptz)
   - `created_at`, `updated_at`

2. **Tabela `chat_messages`**:
   - `id` (uuid, PK)
   - `contact_id` (uuid, FK chat_contacts)
   - `client_id` (uuid, FK profiles)
   - `message_id` (text) - ID do WhatsApp
   - `text` (text)
   - `type` (text) - text, image, audio, video, document, sticker, location, contact
   - `from_me` (boolean)
   - `status` (text) - sending, sent, delivered, read
   - `media_url` (text, nullable)
   - `file_name` (text, nullable)
   - `caption` (text, nullable)
   - `reply_to` (text, nullable)
   - `metadata` (jsonb, nullable)
   - `timestamp` (timestamptz)
   - `created_at`

3. **RLS Policies**: Filtrar por `client_id` do usuário autenticado

4. **Realtime**: Habilitar para ambas as tabelas

---

### Fase 2: Context Provider (`WhatsAppDataContext`)

Criar um provider similar ao painel-helena em:

**Arquivo**: `src/contexts/WhatsAppDataContext.tsx`

Funcionalidades:
- Estado global de contatos e mensagens
- `loadContacts()` - Carrega do Supabase
- `loadMessages(contactId, limit, offset)` - Com paginação
- `syncWithWhatsApp()` - Sincroniza com UaZapi
- Contadores de não lidas (total, individual, grupos)
- Subscriptions Realtime

---

### Fase 3: Componentes do Chat

Criar a estrutura de componentes:

```text
src/
  components/
    chat/
      ChatContainer.tsx      # Container principal
      ChatList.tsx           # Lista de conversas
      ChatContactItem.tsx    # Item de contato
      ChatHeader.tsx         # Header da conversa ativa
      ChatMessages.tsx       # Área de mensagens
      MessageBubble.tsx      # Bolha de mensagem
      QuotedMessage.tsx      # Mensagem citada
      ChatInput.tsx          # Input de mensagem
      ContactDetailsPanel.tsx # Painel de detalhes
      MediaViewer.tsx        # Visualizador de mídia
```

---

### Fase 4: Página do Chat

**Arquivo**: `src/pages/chat/ChatPage.tsx`

Layout:
- Sidebar esquerda (320px): Lista de conversas com abas
- Área central: Mensagens e input
- Painel direito (opcional): Detalhes do contato

---

### Fase 5: Integração com UaZapi

Utilizar os endpoints já existentes:

| Endpoint | Uso |
|----------|-----|
| `chat.find()` | Buscar conversas |
| `chat.getDetails()` | Detalhes do contato |
| `chat.markRead()` | Marcar como lido |
| `message.sendText()` | Enviar texto |
| `message.sendImage()` | Enviar imagem |
| `message.sendAudio()` | Enviar áudio |
| `message.download()` | Download de mídia |
| `/message/find` (POST) | Buscar mensagens (adicionar) |

---

### Fase 6: Rota e Menu

1. Adicionar rota `/chat` no `App.tsx`
2. Adicionar item no menu (sidebar)
3. Integrar com permissões existentes

---

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `src/contexts/WhatsAppDataContext.tsx` | Criar |
| `src/components/chat/ChatContainer.tsx` | Criar |
| `src/components/chat/ChatList.tsx` | Criar |
| `src/components/chat/ChatContactItem.tsx` | Criar |
| `src/components/chat/ChatHeader.tsx` | Criar |
| `src/components/chat/ChatMessages.tsx` | Criar |
| `src/components/chat/MessageBubble.tsx` | Criar |
| `src/components/chat/QuotedMessage.tsx` | Criar |
| `src/components/chat/ChatInput.tsx` | Criar |
| `src/components/chat/ContactDetailsPanel.tsx` | Criar |
| `src/pages/chat/ChatPage.tsx` | Criar |
| `src/types/chat.ts` | Criar |
| `src/lib/uazapi/endpoints/message.ts` | Modificar (adicionar find) |
| `src/App.tsx` | Modificar (adicionar rota) |
| Migration SQL | Criar tabelas |

---

## Decisões de Arquitetura

### Pergunta: Usar banco externo ou Supabase para mensagens?

**Opções:**

1. **Supabase local** (como painel-helena)
   - Vantagem: Realtime nativo, RLS, queries rápidas
   - Desvantagem: Duplicação de dados

2. **Banco externo** (como resto do Julia)
   - Vantagem: Dados centralizados
   - Desvantagem: Sem realtime, mais complexo

3. **Híbrido** (recomendado)
   - Supabase para cache/realtime
   - Sync periódico com UaZapi
   - Webhook para receber novas mensagens

**Recomendação**: Opção 3 (Híbrido) - similar ao painel-helena.

---

## Estimativa de Esforço

| Fase | Complexidade | Componentes |
|------|--------------|-------------|
| Fase 1 | Média | 2 tabelas, RLS, realtime |
| Fase 2 | Alta | Context provider completo |
| Fase 3 | Alta | ~10 componentes |
| Fase 4 | Média | 1 página |
| Fase 5 | Média | Integração endpoints |
| Fase 6 | Baixa | Rota + menu |

**Total estimado**: Implementação robusta

---

## Seção Técnica

### Schema SQL Proposto

```sql
-- Tabela de contatos do chat
CREATE TABLE public.chat_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  cod_agent TEXT,
  phone TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar TEXT,
  is_group BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  is_muted BOOLEAN DEFAULT FALSE,
  unread_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de mensagens
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES chat_contacts(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  message_id TEXT,
  text TEXT,
  type TEXT DEFAULT 'text',
  from_me BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'sent',
  media_url TEXT,
  file_name TEXT,
  caption TEXT,
  reply_to TEXT,
  metadata JSONB,
  timestamp TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_chat_contacts_client ON chat_contacts(client_id);
CREATE INDEX idx_chat_contacts_phone ON chat_contacts(phone);
CREATE INDEX idx_chat_messages_contact ON chat_messages(contact_id);
CREATE INDEX idx_chat_messages_timestamp ON chat_messages(timestamp DESC);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE chat_contacts;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
```

### Estrutura do WhatsAppDataContext

```typescript
interface WhatsAppDataContextValue {
  contacts: ChatContact[];
  messages: Record<string, ChatMessage[]>;
  loading: boolean;
  loadContacts: () => Promise<void>;
  loadMessages: (contactId: string, limit?: number, offset?: number) 
    => Promise<{ messages: ChatMessage[]; hasMore: boolean }>;
  sendMessage: (contactId: string, text: string, replyToId?: string) 
    => Promise<void>;
  sendMedia: (contactId: string, file: File, type: MediaType) 
    => Promise<void>;
  markAsRead: (contactId: string) => Promise<void>;
  syncContacts: () => Promise<void>;
  totalUnreadCount: number;
  individualUnreadCount: number;
  groupUnreadCount: number;
}
```

