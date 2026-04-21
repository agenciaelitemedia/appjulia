

## Migrar configurações de Filas/Chat do Agente para `/configuracoes` → aba **Chat**

### O que muda

1. **Remover** o bloco "Filas de Atendimento" (`QUEUE_LIMIT` + `ALLOW_GROUPS`) do ConfigStep do agente. Essas configurações deixam de viver no JSON `settings` do agente.
2. **Criar** uma nova aba **"Chat"** em `/configuracoes` com gestão de configurações **por cliente** (vínculo `client_id`), usando um único campo `JSONB settings` para suportar expansão futura sem novas migrações.
3. **Ajustar enforcement** (limite de filas + filtro de grupos) para ler do novo storage no Supabase em vez do agente externo.

### Storage (Supabase) — nova tabela `chat_client_settings`

```sql
create table public.chat_client_settings (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,         -- vínculo com agents.client_id (externo)
  client_name text,                        -- snapshot p/ exibir na lista
  client_business_name text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
-- RLS: leitura/escrita autenticada (mesmo padrão das outras tabelas de chat).
-- Índice em client_id (único já cria).
```

Trigger `updated_at` reusando `update_chat_contacts_updated_at()`.

### Schema do JSON `settings` (versionável)

**Bloco solicitado pelo usuário (obrigatório):**
- `QUEUE_LIMIT` (number, default `1`) — total de filas que o cliente pode criar.
- `ALLOW_GROUPS` (bool, default `false`) — habilita aba/ingestão de grupos `@g.us` no Chat.

**Sugestões adicionais (opt-in via checkboxes "configurações avançadas" — usuário escolhe quais ativar agora; o que não ativar fica com default seguro):**

| Chave | Tipo / Default | O que faz |
|---|---|---|
| `SHOW_GROUPS_TAB` | bool / `false` | Mostra a aba "Grupos" na sidebar do `/chat` (depende de ALLOW_GROUPS) |
| `AUTO_ASSIGN_ON_REPLY` | bool / `true` | Atribui ticket ao operador que responder primeiro |
| `BUSINESS_HOURS_BLOCK` | bool / `false` | Bloqueia envio fora do horário de atendimento do agente |
| `QUICK_REPLIES_ENABLED` | bool / `true` | Habilita atalho `/` para mensagens rápidas |
| `READ_RECEIPTS` | bool / `true` | Marca conversa como lida automaticamente ao abrir |
| `TYPING_INDICATOR` | bool / `true` | Envia indicador "digitando..." durante composição |
| `AUTO_RESUME_AFTER_HOURS` | number / `24` | Reabrir ticket fechado se cliente responder dentro de N horas |
| `MAX_FILE_SIZE_MB` | number / `16` | Limite de upload de mídia no chat |
| `NOTIFICATION_SOUND` | bool / `true` | Som de notificação para novas mensagens |
| `SHOW_INTERNAL_NOTES` | bool / `true` | Exibe notas internas (azul) intercaladas no chat |

> Nesta entrega só **persistimos** todos os campos no JSON. **Aplicamos comportamento** apenas para `QUEUE_LIMIT`, `ALLOW_GROUPS` e `SHOW_GROUPS_TAB` (já tem efeito direto no UI/webhook). Os demais ficam disponíveis para wiring incremental nas próximas etapas.

### Fluxo da nova aba "Chat" (UX igual ao print enviado)

```
/configuracoes → Tab "Chat"
┌────────────────────────────────────────────────┐
│ [Lista de configurações por cliente]           │
│  Cliente A  │ 3 filas │ Grupos: ✓ │ Editar 🗑  │
│  Cliente B  │ 1 fila  │ Grupos: ✗ │ Editar 🗑  │
│                                                │
│              [+ Nova Configuração]             │
└────────────────────────────────────────────────┘

Clica "Nova Configuração" → Dialog Step 1 (idêntico ao print/ClientStep):
┌────────────────────────────────────────────────┐
│ Selecionar Cliente                             │
│ [🔍 Buscar cliente por nome, escritório...]   │
│ (lista de resultados via useClientSearch)      │
└────────────────────────────────────────────────┘

Selecionou cliente → Step 2: Formulário de configurações:
┌────────────────────────────────────────────────┐
│ Cliente: Acme Ltda  [Trocar]                   │
│                                                │
│ ─── Filas ───                                  │
│ Total de filas permitidas      [  1  ]         │
│ Permitir grupos                [○──]           │
│                                                │
│ ─── Configurações avançadas ───                │
│ ☐ Mostrar aba "Grupos" no chat                 │
│ ☑ Atribuir ticket ao primeiro a responder      │
│ ☐ Bloquear envio fora do horário               │
│ ☑ Mensagens rápidas (atalho /)                 │
│ ☑ Marcar como lida automaticamente             │
│ ... (toggles para cada chave sugerida)         │
│                                                │
│         [Cancelar]   [Salvar]                  │
└────────────────────────────────────────────────┘
```

Edição reaproveita a Step 2 (cliente já selecionado, sem busca).

### Enforcement — onde os valores são lidos

**A. Limite de filas (`QUEUE_LIMIT`)**
- `supabase/functions/queue-management/index.ts` (action `create`): substituir `getAgentQueueSettings()` (que chamava `db-query`/agente externo) por `supabase.from('chat_client_settings').select('settings').eq('client_id', client_id).maybeSingle()` e ler `settings.QUEUE_LIMIT` (fallback 1). Mantém o gate atual com erro `queue_limit_reached`.
- Frontend `src/pages/agente/filas/hooks/useAgentQueueLimits.ts`: substituir consulta no `externalDb.agents` por `supabase.from('chat_client_settings').select('settings').eq('client_id', user.client_id).maybeSingle()`.

**B. Permissão de grupos (`ALLOW_GROUPS`)**
- `supabase/functions/uazapi-chat-webhook/index.ts`: substituir `getAllowGroupsForClient()` para consultar a nova tabela em vez de chamar `db-query`. Cache em memória 60s preservado.
- Sidebar do Chat: novo hook `useChatClientSettings()` usado por `src/pages/chat/...` para mostrar/ocultar a aba "Grupos" quando `SHOW_GROUPS_TAB && ALLOW_GROUPS`.

**C. Limpeza no agente**
- `src/pages/agents/components/wizard-steps/ConfigStep.tsx`: remover Card "Filas de Atendimento", remover `QUEUE_LIMIT` e `ALLOW_GROUPS` de `ConfigFields` e `DEFAULT_CONFIG`.
- `src/pages/agente/filas/components/QueueFormDialog.tsx`: remover/ajustar o campo informativo "Aceita grupos" para ler da nova fonte (ou esconder se não aplicável).
- Action `get_agent_queue_settings` em `supabase/functions/db-query/index.ts`: marcar como deprecated (manter por compatibilidade, retornar default — sem quebrar webhooks ainda em cache).

### Migração de dados (one-shot opcional)

SQL na migration: para cada `client_id` distinto encontrado em `agents` (via consulta externa não é possível direto), o admin **não precisa migrar** — basta criar a configuração na nova aba quando quiser ajustar. Default global continua `1 fila / sem grupos`, então o comportamento atual (sem registro) é equivalente ao default antigo.

### Arquivos alterados

**Novos**
- `supabase/migrations/<ts>_chat_client_settings.sql` — tabela + RLS + trigger updated_at.
- `src/pages/configuracoes/components/ChatSettingsTab.tsx` — lista de configs + botão "Nova Configuração".
- `src/pages/configuracoes/components/ChatSettingsDialog.tsx` — wizard 2 steps (cliente → formulário).
- `src/pages/configuracoes/components/ChatSettingsClientPicker.tsx` — picker reutilizando `useClientSearch` (estilo do print).
- `src/pages/configuracoes/hooks/useChatClientSettings.ts` — CRUD via supabase + tipos do JSON.

**Editados**
- `src/pages/configuracoes/ConfiguracoesPage.tsx` — adicionar `<TabsTrigger value="chat">` + `<TabsContent>`.
- `src/pages/agents/components/wizard-steps/ConfigStep.tsx` — remover bloco "Filas de Atendimento" e chaves do JSON.
- `src/pages/agente/filas/hooks/useAgentQueueLimits.ts` — trocar fonte para `chat_client_settings`.
- `src/pages/agente/filas/components/QueueFormDialog.tsx` — atualizar/remover campo "Aceita grupos".
- `supabase/functions/queue-management/index.ts` — `getAgentQueueSettings()` agora lê de `chat_client_settings`.
- `supabase/functions/uazapi-chat-webhook/index.ts` — `getAllowGroupsForClient()` agora lê de `chat_client_settings`.

### Resultado esperado

- Bloco "Filas" some do criar/editar agente.
- Em `/configuracoes` → aba **Chat**, admin cria 1 configuração por cliente: busca o cliente (UX idêntica ao print), define `QUEUE_LIMIT`, `ALLOW_GROUPS` e seleciona quais configurações avançadas ativar.
- Limite de filas (UI + backend) e filtro de grupos do webhook passam a respeitar a nova fonte.
- Esquema JSON pronto para receber novas chaves sem migração — basta adicionar o toggle no Dialog e o consumidor onde precisar do efeito.

