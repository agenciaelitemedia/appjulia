

## Plano Revisado: Filas de Atendimento (Supabase) com Sincronização para Agents

### Conceito Atualizado

A tabela `queues` será criada **no Supabase** (não no DB externo). As credenciais de conexão continuam existindo na tabela `agents` do DB externo para **retrocompatibilidade total** — CRM, Follow-up, Notificações, waba-send, meta-webhook continuam funcionando sem mudança. A tabela `queues` é a **fonte primária** de configuração, e uma tabela de vínculo `queue_agent_links` conecta filas a agentes. Quando uma fila é atualizada, as credenciais são **sincronizadas automaticamente** para a tabela `agents` via edge function.

```text
┌──────────────────────┐       ┌─────────────────────┐
│  QUEUES (Supabase)   │       │  AGENTS (DB Externo) │
│  fonte primária de   │──sync─│  mantém credenciais  │
│  credenciais/canal   │       │  para retrocompat.   │
└──────────┬───────────┘       └──────────────────────┘
           │
   ┌───────┴────────┐
   │ queue_agent_    │
   │ links           │
   │ (Supabase)      │
   └───────┬─────────┘
           │
   ┌───────┴────────┐
   │ CHAT            │
   │ conversations   │
   │ + queue_id      │
   └────────────────┘
```

### Regras de Segurança

- **Soft delete em filas**: campo `is_deleted` + `deleted_at`. Fila deletada mantém histórico de conversas.
- **Proteção contra orfandade**: Antes de desativar/deletar uma fila, verificar se há agentes vinculados. Se houver, exigir migração para outra fila ou desvinculação explícita.
- **Migração de atendimentos**: Ao deletar (soft) uma fila, oferecer opção de migrar conversas ativas para outra fila.
- **Sincronização**: Edge function `sync-queue-to-agent` atualiza credenciais na tabela `agents` do DB externo sempre que uma fila é criada/atualizada.

---

### Fase 1 — Modelo de Dados (Supabase)

**Tabela `queues`:**
- `id` (uuid, PK)
- `client_id` (text, NOT NULL)
- `name` (text, NOT NULL) — ex: "WhatsApp Principal", "WABA Comercial"
- `channel_type` (text) — `uazapi`, `waba`, `webchat`, `instagram`
- `hub` (text) — valor sincronizado com agents
- `evo_url`, `evo_apikey`, `evo_instance` (text, nullable) — credenciais UaZapi
- `waba_id`, `waba_token`, `waba_number_id` (text, nullable) — credenciais WABA
- `is_active` (boolean, default true)
- `is_deleted` (boolean, default false) — soft delete
- `deleted_at` (timestamptz, nullable)
- `created_at`, `updated_at`

**Tabela `queue_agent_links`:**
- `id` (uuid, PK)
- `queue_id` (uuid, FK → queues.id)
- `cod_agent` (text, NOT NULL) — referência ao agente no DB externo
- `is_primary` (boolean, default false) — indica se é a fila principal do agente
- `created_at`

**Alterações em tabelas existentes:**
- `chat_conversations`: adicionar `queue_id` (uuid, nullable, FK → queues.id)
- `webchat_config`: adicionar `queue_id` (uuid, nullable, FK → queues.id)
- `instagram_config`: adicionar `queue_id` (uuid, nullable, FK → queues.id)

### Fase 2 — Edge Function de Sincronização

**`sync-queue-to-agent`**: Chamada sempre que uma fila é salva/atualizada.
- Recebe `queue_id`
- Busca todos os `cod_agent` vinculados via `queue_agent_links`
- Para cada agente, atualiza os campos `hub`, `evo_url`, `evo_apikey`, `waba_token`, `waba_number_id` na tabela `agents` do DB externo via `db-query`
- Retorna status de sincronização

**`queue-management`**: CRUD de filas com validações:
- **Criar**: Cria fila + opcionalmente vincula agente + sincroniza
- **Atualizar**: Atualiza credenciais + sincroniza para todos agentes vinculados
- **Deletar (soft)**: Verifica conversas ativas, oferece migração, marca `is_deleted=true`
- **Migrar**: Move conversas de uma fila para outra (atualiza `queue_id` em `chat_conversations`)

### Fase 3 — Frontend: Módulo de Filas

**Nova página `/agente/filas`:**
- Lista de filas com status (ativa, inativa, deletada)
- Criar/editar fila: nome, tipo de canal, credenciais
- QR Code para UaZapi, config WABA (reuso dos componentes existentes)
- Vincular/desvincular agentes (multi-select)
- Ação "Migrar Atendimentos" ao deletar fila
- Indicador visual de agentes vinculados

**Alterações em telas existentes:**
- `AgentCard` / Meus Agentes: mostrar nome da fila vinculada, link para gerenciar
- `ChatList`: filtro por fila além de filtro por agente/canal

### Fase 4 — Atualização dos Webhooks (Chat)

- `meta-webhook`: Após resolver o agente pelo `waba_number_id`, também buscar a `queue_id` correspondente e gravar em `chat_conversations`
- `uazapi-webhook`: Idem, resolver `queue_id` e gravar
- `webchat-api` e `instagram-webhook`: Resolver `queue_id` pela config

**Ponto chave**: Os webhooks continuam resolvendo credenciais pela tabela `agents` (retrocompatibilidade). A `queue_id` é adicionada como metadado extra nas conversas.

---

### O que NÃO muda

- `get-agent-credentials.ts` — continua lendo de `agents` (dados sincronizados)
- `messaging-factory.ts` — sem alteração
- `contract-notifications-cron/queue` — sem alteração
- `waba-send` — sem alteração  
- CRM, Follow-up, DataJud — sem alteração
- Toda funcionalidade existente permanece 100% operacional

### Estimativa

| Fase | Escopo | Risco |
|---|---|---|
| 1 - Tabelas Supabase | 1 migration | Baixo |
| 2 - Edge functions sync + CRUD | 2 funções | Médio |
| 3 - Frontend filas | 1 página + ajustes | Baixo |
| 4 - Webhooks queue_id | 4 funções ajustadas | Médio |

