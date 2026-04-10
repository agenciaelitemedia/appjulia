

## Plano: Melhorar popup de chat + Módulo de Mensagens Rápidas

### Contexto
O `WhatsAppMessagesDialog` é usado em 6+ locais (CRM, Desempenho, Contratos, Campanhas, Follow-up). Hoje tem apenas input de texto simples. Precisa ganhar: envio de áudio, envio de arquivos, mensagens rápidas e notas (preparado para futuro).

### Arquitetura

```text
┌─────────────────────────────────────────────────┐
│  WhatsAppMessagesDialog (popup)                 │
│  ┌─────────────────────────────────────────────┐│
│  │  Área de mensagens (sem mudança)            ││
│  ├─────────────────────────────────────────────┤│
│  │  Nova barra de input com abas visuais:      ││
│  │  [⚡ Rápidas] [📎 Arquivo] [🎤 Áudio]      ││
│  │                                             ││
│  │  Modo padrão: Textarea + Send               ││
│  │  Modo rápidas: Lista filtrada de msgs       ││
│  │  Modo arquivo: Botões imagem/vídeo/doc      ││
│  │  Modo áudio: Gravar PTT (futuro, placeholder)││
│  │                                             ││
│  │  [📝 Nota] preparado mas desabilitado       ││
│  └─────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
```

### Implementação

#### 1. Tabela no Supabase: `quick_messages`
Nova tabela para armazenar mensagens rápidas.

```sql
CREATE TABLE public.quick_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  message_text TEXT NOT NULL,
  shortcut TEXT,
  category TEXT DEFAULT 'geral',
  use_locations TEXT[] DEFAULT '{chat_popup}',
  is_active BOOLEAN DEFAULT true,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.quick_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on quick_messages" ON public.quick_messages FOR ALL USING (true) WITH CHECK (true);
```

- `use_locations`: array com os locais onde a mensagem aparece (`chat_popup`, `chat_full`, `followup`, etc.)
- `user_id`: vinculado ao usuário que criou

#### 2. Módulo "Mensagens Rápidas" (categoria SISTEMA)
- Nova página `/mensagens-rapidas`
- Código do módulo: `quick_messages`
- Grupo: `SISTEMA`
- CRUD completo: criar, editar, excluir mensagens pré-definidas
- Campos: título, texto da mensagem, atalho (opcional), categoria, locais de uso (multi-select: "Chat Rápido", etc.)
- Garantir módulo via hook `useEnsureQuickMessagesModule`

#### 3. Melhorar input do `WhatsAppMessagesDialog`
Substituir o input simples por um componente rico:

- **Barra de ações** acima do textarea com ícones pequenos:
  - ⚡ **Mensagens rápidas**: abre popover com lista filtrada (busca inline), clique insere o texto no textarea
  - 📎 **Anexar**: dropdown com Imagem/Vídeo/Documento (mesma lógica do ChatInput do /chat)
  - 🎤 **Áudio**: botão preparado (disabled com tooltip "em breve")
  - 📝 **Nota**: botão preparado (disabled com tooltip "em breve")
  - 😊 **Emojis**: popover com emojis rápidos (igual ao ChatInput)
- **Textarea** substituindo o Input (suporte a multi-linha, auto-resize, Enter para enviar, Shift+Enter para quebra)
- **Envio de arquivos**: lógica de upload + envio via UaZapi (`/send/file-base64`) ou WABA (`waba-send` com action `send_media`)

#### 4. Envio de mídia no popup
- Para **UaZapi**: converter arquivo para base64, enviar via `/send/file-base64` com `{ number, base64, mimetype, fileName }`
- Para **WABA**: enviar via edge function `waba-send` com action `send_media`
- Adicionar mensagem local no estado após envio (tipo imagem/documento/vídeo)

#### 5. Hook `useQuickMessages`
- Busca mensagens rápidas do Supabase filtrando por `use_locations @> '{chat_popup}'` e `is_active = true`
- Cache com react-query (staleTime: 5min)
- Retorna lista ordenada por position

### Arquivos a criar/editar

| Arquivo | Ação |
|---------|------|
| `supabase migration` | Criar tabela `quick_messages` |
| `src/hooks/useQuickMessages.ts` | Hook para buscar/CRUD mensagens rápidas |
| `src/pages/mensagens-rapidas/QuickMessagesPage.tsx` | Página CRUD do módulo |
| `src/pages/crm/components/WhatsAppMessagesDialog.tsx` | Refatorar input area |
| `src/App.tsx` | Adicionar rota `/mensagens-rapidas` |
| `supabase/functions/db-query/index.ts` | Garantir módulo quick_messages no menu |

### UX/UI

- Barra de ações compacta (ícones 20px) integrada ao campo de input, estilo WhatsApp Web
- Popover de mensagens rápidas com busca: campo de filtro no topo + lista scrollável com título em negrito e preview do texto
- Clique na mensagem rápida preenche o textarea (não envia direto, permite editar antes)
- Upload de arquivo mostra preview inline antes de enviar
- Feedback visual claro de envio (loader no botão)

