

## Plano: Módulo de Chat/Atendimento Omnichannel Completo

### Diagnóstico do Estado Atual

O módulo `/chat` atual é um **viewer de conversas** básico com:
- Lista de contatos com busca e filtro (individual/grupos)
- Seleção de agente (UaZapi/WABA)
- Envio de texto e mídia (imagem, vídeo, documento)
- Mensagens em tempo real via Realtime
- Armazenamento em `chat_contacts` + `chat_messages`

**O que falta para ser um sistema de atendimento real** (comparando com Whaticket, Chatwoot, Typebot, etc.):
- Sem conceito de "ticket/conversa" (abertura, fechamento, protocolo)
- Sem filas de atendimento ou distribuição de conversas
- Sem transferência entre atendentes
- Sem notas internas no chat (existe no CRM popup, mas não no módulo /chat)
- Sem tags/etiquetas nas conversas
- Sem mensagens rápidas integradas
- Sem gravação de áudio funcional
- Mídias não são persistidas em Storage (ficam como URLs externas que expiram)
- Sem suporte a WebChat ou Instagram
- Sem métricas de atendimento (tempo de resposta, SLA)
- Sem indicador de "digitando..." ou presença online

---

### Arquitetura Proposta

```text
┌─────────────────────────────────────────────────────────────────┐
│                    CANAIS DE ENTRADA                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │  UaZapi   │  │  WABA    │  │ WebChat  │  │  Instagram   │   │
│  │ (webhook) │  │(webhook) │  │(realtime)│  │  (webhook)   │   │
│  └─────┬─────┘  └─────┬────┘  └────┬─────┘  └──────┬───────┘  │
│        └──────────┬────┴────────────┴───────────────┘          │
│                   ▼                                             │
│         chat_conversations (ticket)                             │
│         chat_messages (mensagens)                               │
│         chat_media (storage bucket)                             │
└─────────────────────────────────────────────────────────────────┘
```

---

### Fases de Implementação

#### Fase 1 — Modelo de Conversas (Tickets) + Persistência de Mídia

**Banco de dados — nova tabela `chat_conversations`:**
- `id`, `contact_id`, `client_id`, `cod_agent`
- `channel` (uazapi | waba | webchat | instagram)
- `status` (pending | open | closed | resolved)
- `protocol` (número sequencial gerado automaticamente)
- `assigned_to` (ID do atendente)
- `department` (setor/fila)
- `priority` (low | normal | high | urgent)
- `tags` (text[])
- `opened_at`, `first_response_at`, `closed_at`, `resolved_at`
- `close_reason`, `close_note`
- `metadata` (jsonb)

**Alterações em `chat_messages`:**
- Adicionar coluna `conversation_id` (FK para chat_conversations)
- Adicionar coluna `internal_note` (boolean, default false) — notas internas
- Adicionar coluna `sender_name` (nome do atendente que enviou)

**Persistência de mídias em Storage:**
- Criar Edge Function `chat-media-upload` que recebe base64, salva no bucket `chat-media` e retorna a URL pública
- Ao enviar/receber mídia, gravar no Storage e salvar URL permanente em `chat_messages.media_url`
- Atualizar webhooks (meta-webhook, uazapi-webhook) para baixar e persistir mídias recebidas

**Regras de negócio:**
- Ao receber mensagem de contato sem conversa aberta → criar conversa com status `pending`
- Ao atendente responder → mudar para `open`, registrar `first_response_at`
- Botão de "Encerrar conversa" → status `closed`, registrar motivo
- Protocolo auto-gerado (ex: `#2025-001234`)

#### Fase 2 — Interface do Módulo de Chat Redesenhada

**Layout 3 painéis (estilo Chatwoot/Whaticket):**

```text
┌──────────────┬────────────────────┬──────────────┐
│  SIDEBAR     │    CHAT AREA       │  DETALHES    │
│              │                    │  DO CONTATO  │
│ • Filtros    │  Header + Status   │              │
│ • Filas      │  Mensagens         │  • Info      │
│ • Busca      │  Input + Ações     │  • Tags      │
│ • Conversas  │                    │  • Histórico │
│              │                    │  • Notas     │
└──────────────┴────────────────────┴──────────────┘
```

**Sidebar esquerda (lista de conversas):**
- Filtros por status: Pendentes | Em atendimento | Resolvidas
- Filtro por canal (ícone WhatsApp/WABA/Web/Instagram)
- Filtro por atendente (meus | todos)
- Indicador visual de canal em cada conversa
- Badge de tempo de espera (ex: "Aguardando há 15min")
- Contagem de não lidas por filtro

**Área central (chat):**
- Header com: nome, canal, status da conversa, botões de ação
- Botões: Transferir | Encerrar | Marcar como Resolvido
- Input com: mensagens rápidas, notas internas (toggle azul como no CRM), assinatura, gravação de áudio funcional (MediaRecorder), anexos
- Indicador de "digitando..." via Realtime
- Timeline de eventos (conversa aberta, transferida, encerrada)

**Painel direito (detalhes):**
- Informações do contato (nome editável, telefone, email)
- Canal de origem
- Tags da conversa (adicionar/remover)
- Protocolo e timestamps
- Histórico de conversas anteriores do contato
- Notas internas
- Dados do CRM (se existir card vinculado)

#### Fase 3 — Funcionalidades Avançadas de Atendimento

**Filas e distribuição:**
- Tabela `chat_departments` (id, name, agents[])
- Distribuição round-robin ou por menor carga
- Transferência entre atendentes/setores com nota

**Mensagens rápidas no chat:**
- Integrar com tabela `quick_messages` existente
- Atalho `/` no input para buscar mensagens rápidas
- Filtro por `use_locations` incluindo `chat_module`

**Gravação de áudio:**
- MediaRecorder API com timer e cancelamento
- Upload para Storage via edge function
- Envio via adaptador do canal (UaZapi/WABA)

**Tags e etiquetas:**
- Tabela `chat_tags` (id, name, color, client_id)
- Associação conversa ↔ tags
- Filtro por tags na sidebar

**Histórico completo:**
- Ao encerrar conversa, todo histórico permanece acessível
- Busca global por mensagens (full-text search)
- Exportação de conversa

#### Fase 4 — Novos Canais (WebChat + Instagram)

**WebChat:**
- Widget embeddable (React component isolado)
- Comunicação via Supabase Realtime diretamente
- Canal `webchat` → mesma tabela `chat_messages`
- Customização visual (cores, logo, posição)

**Instagram:**
- Edge Function `instagram-webhook` para receber mensagens da Graph API
- Envio via `instagram-send` (Graph API Messaging)
- Canal `instagram` → mesma tabela `chat_messages`
- Requer configuração do Instagram Business via Facebook App

#### Fase 5 — Métricas e Dashboard de Atendimento

- Tempo médio de primeira resposta
- Tempo médio de resolução
- Conversas por canal/atendente/período
- SLA (conversas respondidas dentro do prazo)
- Dashboard com gráficos no módulo `/chat`

---

### Detalhes Técnicos

**Tabelas novas (migration SQL):**
- `chat_conversations` — ticket principal
- `chat_departments` — filas/setores
- `chat_tags` + `chat_conversation_tags` — etiquetas
- `chat_conversation_history` — log de eventos (transfer, close, reopen)

**Edge Functions novas:**
- `chat-media-upload` — persistir mídias no Storage
- `instagram-webhook` — receber mensagens do Instagram
- `instagram-send` — enviar mensagens via Instagram

**Alterações em Edge Functions existentes:**
- `meta-webhook` e `uazapi-webhook` — criar/atualizar `chat_conversations` automaticamente ao receber mensagem
- `waba-send` — atualizar `first_response_at` quando atendente responde

**Frontend — arquivos novos/alterados:**
- Refatorar `WhatsAppDataContext` para incluir conceito de conversas
- Novos componentes: `ConversationFilters`, `ConversationDetailPanel`, `ConversationTimeline`, `AudioRecorder`, `QuickMessagePicker`, `ChatTagManager`
- Redesign do `ChatContainer` para layout 3 painéis

---

### Prioridade de Execução Sugerida

1. **Fase 1** — Fundação (conversations + media storage) — essencial
2. **Fase 2** — Interface redesenhada — visível ao usuário
3. **Fase 3** — Funcionalidades avançadas — diferencial competitivo
4. **Fase 4** — Novos canais — expansão
5. **Fase 5** — Métricas — gestão

Devo começar pela **Fase 1** (modelo de dados + persistência de mídia)?

