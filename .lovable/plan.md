

## Plano: Módulo "Atendimento Humano"

### Visão Geral

Criar um novo módulo full-page em `/atendimento-humano` com layout WhatsApp (lista de conversas à esquerda, chat à direita). A lista mostra apenas leads do CRM cuja sessão da Julia IA está **inativa** (`active = false`). Cada item exibe badges com a fase atual do CRM. Ao clicar, abre o chat completo reutilizando toda a lógica do `WhatsAppMessagesDialog` (envio de texto, áudio, mídia, notas internas, mensagens rápidas, contrato, status do bot, edição de nome).

### Arquitetura

```text
┌─────────────────────────────────────────────────────┐
│  /atendimento-humano                                │
│ ┌──────────────┬────────────────────────────────────┐│
│ │  Sidebar      │   Chat Area                       ││
│ │  (320px)      │   (flex-1)                        ││
│ │               │                                   ││
│ │  [Busca]      │   Header: nome, tel, bot, contrato││
│ │  [Filtros]    │   ─────────────────────────────── ││
│ │               │   Mensagens (scroll infinito)     ││
│ │  Lead 1  🔴   │                                   ││
│ │  ├ Badge: fase│                                   ││
│ │  Lead 2  🔴   │   ─────────────────────────────── ││
│ │  ├ Badge: fase│   Input: texto/áudio/mídia/notas  ││
│ └──────────────┴────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

### Dados

A lista de leads será carregada em dois passos:

1. **Buscar sessões inativas** — query no banco externo: `SELECT * FROM sessions WHERE active = false AND cod_agent = ANY($1)` (via nova action `get_inactive_sessions` na edge function `external-db-query`)
2. **Enriquecer com dados do CRM** — para cada sessão inativa, buscar o card CRM correspondente (`crm_atendimento_cards` por `whatsapp_number` + `cod_agent`) para obter `contact_name`, `stage_name`, `stage_color`, `stage_entered_at`

### Mudanças

#### 1. Tipo de módulo + rota

- Adicionar `'human_support'` ao type `ModuleCode` em `src/types/permissions.ts`
- Adicionar rota `/atendimento-humano` no `App.tsx` com `ProtectedRoute module="human_support"`
- Registrar o módulo no banco externo (via admin/módulos) — categoria "sistema"

#### 2. Edge Function — nova action `get_inactive_sessions`

Adicionar na edge function `external-db-query` uma action que retorna sessões inativas enriquecidas com dados do CRM:

```sql
SELECT s.id, s.whatsapp_number, s.cod_agent, s.updated_at,
       c.contact_name, c.stage_id, st.name as stage_name, st.color as stage_color,
       c.business_name, c.id as card_id
FROM sessions s
LEFT JOIN crm_atendimento_cards c ON c.whatsapp_number = s.whatsapp_number 
  AND c.cod_agent = s.cod_agent::bigint
LEFT JOIN crm_atendimento_stages st ON st.id = c.stage_id
WHERE s.active = false AND s.cod_agent::text = ANY($1)
ORDER BY s.updated_at DESC
```

#### 3. Hook — `useInactiveLeads`

Novo hook em `src/pages/atendimento-humano/hooks/useInactiveLeads.ts`:
- Chama `externalDb.invoke({ action: 'get_inactive_sessions', data: { agentCodes } })`
- Retorna lista tipada com nome, telefone, fase, cor, último update
- Suporta busca local por nome/telefone
- `refetchInterval: 30_000` para manter atualizado

#### 4. Página — `HumanSupportPage.tsx`

Novo arquivo `src/pages/atendimento-humano/HumanSupportPage.tsx`:
- Layout de 3 colunas (sidebar + chat + detalhe contrato opcional)
- **Sidebar esquerda**: lista de leads inativos com:
  - Avatar com iniciais
  - Nome do lead + número
  - Badge colorido com nome da fase do CRM
  - Tempo relativo desde última interação (`formatDistanceToNow`)
  - Indicador visual de seleção (borda esquerda primary)
  - Campo de busca no topo
  - Filtro por agente (multi-select)
- **Área central**: Reutiliza a lógica completa do `WhatsAppMessagesDialog` mas inline (não em dialog/sheet). Extrair as partes internas do componente para serem reusáveis:
  - Header com nome editável, telefone, ícone bot + switch, ícone contrato
  - Área de mensagens com scroll infinito e agrupamento por data
  - Barra de input com: mensagens rápidas, anexos, áudio, notas internas, assinatura

#### 5. Refatoração do WhatsAppMessagesDialog

Extrair a lógica core do `WhatsAppMessagesDialog` (2243 linhas) em componentes reutilizáveis:

- `src/pages/crm/components/chat/ChatCore.tsx` — componente que recebe `whatsappNumber`, `codAgent`, `leadName` e renderiza header + mensagens + input inline (sem wrapper Dialog/Sheet)
- O `WhatsAppMessagesDialog` existente passará a usar `ChatCore` internamente, mantendo compatibilidade total
- O `HumanSupportPage` também usa `ChatCore` na área central

#### 6. Menu lateral

Adicionar item "Atendimento Humano" na sidebar de navegação, categoria "Sistemas", com ícone `Headset` do Lucide.

### Arquivos

| Arquivo | Ação |
|---------|------|
| `src/types/permissions.ts` | Adicionar `'human_support'` ao `ModuleCode` |
| `src/App.tsx` | Nova rota `/atendimento-humano` |
| `src/pages/atendimento-humano/HumanSupportPage.tsx` | Nova página principal |
| `src/pages/atendimento-humano/hooks/useInactiveLeads.ts` | Hook para buscar leads inativos |
| `src/pages/atendimento-humano/components/InactiveLeadsList.tsx` | Sidebar com lista de leads |
| `src/pages/atendimento-humano/components/InactiveLeadItem.tsx` | Item individual na lista |
| `src/pages/crm/components/chat/ChatCore.tsx` | Lógica core extraída do WhatsAppMessagesDialog |
| `src/pages/crm/components/WhatsAppMessagesDialog.tsx` | Refatorar para usar ChatCore |
| `supabase/functions/external-db-query/index.ts` | Nova action `get_inactive_sessions` |
| Sidebar/Menu config | Adicionar item de menu |

### UX

- Ao reativar a Julia (via switch no header), o lead desaparece automaticamente da lista (na próxima atualização)
- Badge da fase do CRM usa a mesma cor do pipeline do CRM
- Busca filtra por nome ou número em tempo real
- Responsivo: em mobile, mostra lista ou chat (toggle como no WhatsApp)
- Sem mensagem selecionada: tela vazia com ícone Headset e texto "Selecione um lead para atender"

