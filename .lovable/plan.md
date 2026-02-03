
# Plano de Implementação: Módulo Advbox

## Visão Geral

Implementação completa da integração com Advbox dentro do painel Julia, permitindo:
- Configuração de credenciais e teste de conexão
- Notificações automáticas de movimentações processuais via WhatsApp
- Consultas de processos via chat (Julia IA)
- Cadastro automático de leads no Advbox

---

## Arquitetura

```text
┌─────────────────────────────────────────────────────────────┐
│                    PAINEL ADMIN (React)                     │
│  src/pages/advbox/                                          │
│  ├── IntegrationPage.tsx      # Configurar credenciais      │
│  ├── NotificationRulesPage.tsx # Gerenciar regras           │
│  ├── ProcessesPage.tsx        # Cache de processos          │
│  ├── LogsPage.tsx             # Histórico notificações      │
│  └── QueriesPage.tsx          # Consultas de clientes       │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ Edge Functions
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              BACKEND (Edge Functions)                       │
│  supabase/functions/                                        │
│  ├── advbox-integration/      # CRUD integração + teste     │
│  ├── advbox-sync/             # Sincronizar processos       │
│  ├── advbox-query/            # Consulta cliente            │
│  └── advbox-notify/           # Disparar notificações       │
└───────────────────────┬─────────────────────────────────────┘
                        │
              ┌─────────┴─────────┐
              ▼                   ▼
┌─────────────────────┐ ┌─────────────────────┐
│   Banco Externo     │ │    Advbox API       │
│  (7 novas tabelas)  │ │  (REST externo)     │
└─────────────────────┘ └─────────────────────┘
```

---

## Fase 1: Tipos TypeScript

### Arquivo: `src/types/advbox.ts`

```typescript
// Tipos para o módulo Advbox

export type ConnectionStatus = 'pending' | 'connected' | 'error';
export type NotificationStatus = 'pending' | 'sent' | 'failed';
export type SyncStatus = 'pending' | 'synced' | 'failed';
export type SendTo = 'cliente' | 'advogado' | 'ambos';
export type LeadSource = 'whatsapp_chat' | 'web_form' | 'manual';

export interface AdvboxSettings {
  auto_sync_interval?: number; // segundos (min: 300)
  enable_notifications?: boolean;
  enable_client_queries?: boolean;
  enable_lead_sync?: boolean;
}

export interface AdvboxIntegration {
  id: string;
  agent_id: number;
  api_endpoint: string;
  api_token: string; // criptografado no banco
  is_active: boolean;
  connection_status: ConnectionStatus;
  last_sync_at: string | null;
  last_error: string | null;
  settings: AdvboxSettings;
  created_at: string;
  updated_at: string;
  // Computed fields from API
  total_processes_cached?: number;
  notifications_sent_24h?: number;
  queries_answered_24h?: number;
}

export interface AdvboxNotificationRule {
  id: string;
  agent_id: number;
  integration_id: string;
  rule_name: string;
  is_active: boolean;
  process_phases: string[];
  event_types: string[];
  keywords: string[];
  message_template: string;
  send_to: SendTo;
  cooldown_minutes: number;
  created_at: string;
  updated_at: string;
  // Computed
  notifications_sent?: number;
  last_triggered?: string | null;
}

export interface AdvboxProcess {
  id: string;
  agent_id: number;
  integration_id: string;
  process_id: string;
  process_number: string;
  client_id: string;
  client_name: string;
  client_phone: string;
  phase: string;
  status: string;
  responsible: string;
  last_movement_id: string;
  last_movement_date: string;
  last_movement_text: string;
  full_data: Record<string, unknown>;
  cached_at: string;
  created_at: string;
  updated_at: string;
}

export interface AdvboxNotificationLog {
  id: string;
  agent_id: number;
  integration_id: string;
  rule_id: string | null;
  rule_name?: string;
  process_id: string;
  process_number?: string;
  recipient_phone: string;
  message_text: string;
  status: NotificationStatus;
  sent_at: string | null;
  error_message: string | null;
  whatsapp_message_id: string | null;
  whatsapp_response: Record<string, unknown> | null;
  created_at: string;
}

export interface AdvboxClientQuery {
  id: string;
  agent_id: number;
  integration_id: string;
  client_phone: string;
  client_name: string | null;
  query_text: string;
  query_type: string;
  found_processes: number;
  response_text: string | null;
  response_sent: boolean;
  query_time_ms: number;
  created_at: string;
}

export interface AdvboxLeadSync {
  id: string;
  agent_id: number;
  integration_id: string;
  whatsapp_number: string;
  lead_name: string;
  lead_email: string | null;
  lead_source: LeadSource;
  lead_notes: string | null;
  sync_status: SyncStatus;
  advbox_client_id: string | null;
  synced_at: string | null;
  error_message: string | null;
  retry_count: number;
  full_lead_data: Record<string, unknown> | null;
  advbox_response: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// Template variables
export type TemplateVariable = 
  | 'client_name' 
  | 'process_number' 
  | 'movement_text'
  | 'movement_date'
  | 'phase'
  | 'responsible'
  | 'law_firm_name';

export const TEMPLATE_VARIABLES: { key: TemplateVariable; label: string }[] = [
  { key: 'client_name', label: 'Nome do Cliente' },
  { key: 'process_number', label: 'Número do Processo' },
  { key: 'movement_text', label: 'Texto da Movimentação' },
  { key: 'movement_date', label: 'Data da Movimentação' },
  { key: 'phase', label: 'Fase do Processo' },
  { key: 'responsible', label: 'Responsável' },
  { key: 'law_firm_name', label: 'Nome do Escritório' },
];

export const PROCESS_PHASES = [
  'Judicial',
  'Recursal',
  'Execução',
  'Consultoria',
  'Marketing',
  'Administrativo',
];

export const EVENT_TYPES = [
  'Sentença',
  'Acórdão',
  'Intimação',
  'Audiência',
  'Despacho',
  'Decisão',
  'Petição',
  'Movimentação',
];
```

---

## Fase 2: Banco de Dados (Tabelas no Banco Externo)

As tabelas serão criadas no banco externo via `db-query` action. Adicionar actions no `db-query/index.ts`:

### Novas Actions para `db-query`:

```typescript
// Advbox CRUD actions
case 'advbox_get_integration':
case 'advbox_save_integration':
case 'advbox_delete_integration':
case 'advbox_get_rules':
case 'advbox_save_rule':
case 'advbox_delete_rule':
case 'advbox_get_processes':
case 'advbox_get_notification_logs':
case 'advbox_get_client_queries':
case 'advbox_save_notification_log':
case 'advbox_save_client_query':
```

### SQL para criar tabelas (executar no banco externo):

```sql
-- advbox_integrations
CREATE TABLE advbox_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id INTEGER NOT NULL UNIQUE,
  api_endpoint TEXT NOT NULL,
  api_token TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  last_sync_at TIMESTAMPTZ,
  connection_status TEXT DEFAULT 'pending',
  last_error TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- advbox_notification_rules
CREATE TABLE advbox_notification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id INTEGER NOT NULL,
  integration_id UUID REFERENCES advbox_integrations(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  process_phases TEXT[],
  event_types TEXT[],
  keywords TEXT[],
  message_template TEXT NOT NULL,
  send_to TEXT DEFAULT 'cliente',
  cooldown_minutes INTEGER DEFAULT 60,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- advbox_processes_cache
CREATE TABLE advbox_processes_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id INTEGER NOT NULL,
  integration_id UUID REFERENCES advbox_integrations(id) ON DELETE CASCADE,
  process_id TEXT NOT NULL,
  process_number TEXT,
  client_id TEXT,
  client_name TEXT,
  client_phone TEXT,
  phase TEXT,
  status TEXT,
  responsible TEXT,
  last_movement_id TEXT,
  last_movement_date TIMESTAMPTZ,
  last_movement_text TEXT,
  full_data JSONB,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, process_id)
);

-- advbox_notification_logs
CREATE TABLE advbox_notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id INTEGER NOT NULL,
  integration_id UUID REFERENCES advbox_integrations(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES advbox_notification_rules(id) ON DELETE SET NULL,
  process_id TEXT,
  recipient_phone TEXT NOT NULL,
  message_text TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  whatsapp_message_id TEXT,
  whatsapp_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- advbox_client_queries
CREATE TABLE advbox_client_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id INTEGER NOT NULL,
  integration_id UUID REFERENCES advbox_integrations(id) ON DELETE CASCADE,
  client_phone TEXT NOT NULL,
  client_name TEXT,
  query_text TEXT NOT NULL,
  query_type TEXT,
  found_processes INTEGER DEFAULT 0,
  response_text TEXT,
  response_sent BOOLEAN DEFAULT false,
  query_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- advbox_lead_sync
CREATE TABLE advbox_lead_sync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id INTEGER NOT NULL,
  integration_id UUID REFERENCES advbox_integrations(id) ON DELETE CASCADE,
  whatsapp_number TEXT NOT NULL,
  lead_name TEXT NOT NULL,
  lead_email TEXT,
  lead_source TEXT,
  lead_notes TEXT,
  sync_status TEXT DEFAULT 'pending',
  advbox_client_id TEXT,
  synced_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  full_lead_data JSONB,
  advbox_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_advbox_agent ON advbox_integrations(agent_id);
CREATE INDEX idx_advbox_rules_agent ON advbox_notification_rules(agent_id);
CREATE INDEX idx_advbox_processes_agent ON advbox_processes_cache(agent_id);
CREATE INDEX idx_advbox_processes_phone ON advbox_processes_cache(client_phone);
CREATE INDEX idx_advbox_logs_agent ON advbox_notification_logs(agent_id);
CREATE INDEX idx_advbox_logs_status ON advbox_notification_logs(status);
CREATE INDEX idx_advbox_queries_agent ON advbox_client_queries(agent_id);
CREATE INDEX idx_advbox_lead_sync_agent ON advbox_lead_sync(agent_id);
```

---

## Fase 3: Edge Functions

### 3.1 `advbox-integration` (CRUD + Teste de Conexão)

```typescript
// supabase/functions/advbox-integration/index.ts
// - POST / - Criar/atualizar integração
// - POST /test - Testar conexão com Advbox
// - GET /?agent_id=X - Listar integração do agente
// - DELETE /:id - Desativar integração
```

### 3.2 `advbox-sync` (Sincronização de Processos)

```typescript
// supabase/functions/advbox-sync/index.ts
// - POST / - Iniciar sincronização manual
// - Busca processos no Advbox API
// - Atualiza cache local
// - Detecta novas movimentações
// - Dispara notificações conforme regras
```

### 3.3 `advbox-query` (Consulta de Processos)

```typescript
// supabase/functions/advbox-query/index.ts
// - POST / - Buscar processos do cliente
// - Chamado pelo n8n/Julia IA
// - Retorna dados formatados para WhatsApp
```

### 3.4 `advbox-notify` (Envio de Notificações)

```typescript
// supabase/functions/advbox-notify/index.ts
// - POST / - Enviar notificação via n8n Hub
// - Renderiza template com variáveis
// - Registra log de envio
```

---

## Fase 4: Frontend - Estrutura de Arquivos

```text
src/
├── pages/
│   └── advbox/
│       ├── IntegrationPage.tsx        # Configuração principal
│       ├── NotificationRulesPage.tsx  # Gerenciar regras
│       ├── ProcessesPage.tsx          # Ver processos em cache
│       ├── LogsPage.tsx               # Histórico notificações
│       └── QueriesPage.tsx            # Consultas clientes
├── components/
│   └── advbox/
│       ├── IntegrationForm.tsx        # Form de configuração
│       ├── ConnectionStatusBadge.tsx  # Badge de status
│       ├── RuleEditor.tsx             # Dialog editor de regra
│       ├── TemplateEditor.tsx         # Editor de template
│       ├── TemplatePreview.tsx        # Preview da mensagem
│       ├── ProcessCard.tsx            # Card de processo
│       ├── NotificationLogItem.tsx    # Item de log
│       └── AdvboxDashboard.tsx        # Dashboard resumo
├── hooks/
│   └── advbox/
│       ├── useAdvboxIntegration.ts    # CRUD integração
│       ├── useNotificationRules.ts    # CRUD regras
│       ├── useProcessesCache.ts       # Lista processos
│       ├── useNotificationLogs.ts     # Histórico
│       └── useClientQueries.ts        # Consultas
└── types/
    └── advbox.ts                      # Types (já criado acima)
```

---

## Fase 5: Páginas do Frontend

### 5.1 IntegrationPage (Configuração)

- Formulário para endpoint e token
- Botão "Testar Conexão" com feedback visual
- Switches para ativar/desativar features
- Estatísticas resumidas (processos, notificações 24h)

### 5.2 NotificationRulesPage (Regras)

- Lista de regras com status ativo/inativo
- Contador de notificações enviadas
- Dialog para criar/editar regra
- Editor de template com variáveis

### 5.3 ProcessesPage (Cache)

- Tabela de processos em cache
- Filtros por fase, status, cliente
- Botão sincronizar manualmente
- Data da última sincronização

### 5.4 LogsPage (Histórico)

- Tabela paginada com filtros
- Status visual: enviada/pendente/falha
- Botão reenviar para falhas

### 5.5 QueriesPage (Consultas)

- Histórico de consultas de clientes
- Dados: cliente, pergunta, processos encontrados, tempo

---

## Fase 6: Rotas e Navegação

### Adicionar ao App.tsx:

```typescript
import AdvboxIntegrationPage from './pages/advbox/IntegrationPage';
import AdvboxNotificationRulesPage from './pages/advbox/NotificationRulesPage';
import AdvboxProcessesPage from './pages/advbox/ProcessesPage';
import AdvboxLogsPage from './pages/advbox/LogsPage';
import AdvboxQueriesPage from './pages/advbox/QueriesPage';

// Dentro do MainLayout
<Route path="/advbox" element={<AdvboxIntegrationPage />} />
<Route path="/advbox/regras" element={<AdvboxNotificationRulesPage />} />
<Route path="/advbox/processos" element={<AdvboxProcessesPage />} />
<Route path="/advbox/logs" element={<AdvboxLogsPage />} />
<Route path="/advbox/consultas" element={<AdvboxQueriesPage />} />
```

### Adicionar ícone ao iconMap:

```typescript
import { Scale } from 'lucide-react';
// Adicionar: Scale (ícone jurídico)
```

### Registrar Módulo na tabela `modules`:

```sql
INSERT INTO modules (code, name, category, is_active, display_order, icon, route, menu_group, is_menu_visible)
VALUES ('advbox_integration', 'Advbox', 'integracao', true, 100, 'Scale', '/advbox', 'INTEGRAÇÕES', true);
```

---

## Fase 7: Hooks Customizados

### useAdvboxIntegration.ts

```typescript
// Funções:
// - loadIntegration(agentId)
// - saveIntegration(data)
// - testConnection(endpoint, token)
// - deleteIntegration(id)
```

### useNotificationRules.ts

```typescript
// Funções:
// - loadRules(agentId)
// - saveRule(data)
// - toggleRule(id, isActive)
// - deleteRule(id)
```

---

## Fase 8: Integração com n8n Julia

### Tool: `search_process_advbox`

Endpoint chamado pela Julia IA para buscar processos do cliente:

```text
POST /advbox-query
{
  "agent_id": 123,
  "client_phone": "5534988860163",
  "query_type": "status_processo"
}
```

### Tool: `create_lead_advbox`

Endpoint para criar lead automaticamente no Advbox:

```text
POST /advbox-lead-sync
{
  "agent_id": 123,
  "lead": {
    "whatsapp_number": "5534...",
    "name": "Carlos Silva",
    "source": "whatsapp_chat"
  }
}
```

---

## Secrets Necessários

| Secret | Descrição |
|--------|-----------|
| `ADVBOX_ENCRYPTION_KEY` | Chave 32 bytes para criptografar tokens |
| `N8N_HUB_SEND_URL` | URL do hub n8n para envio WhatsApp |

---

## Ordem de Implementação

| Fase | Descrição | Arquivos |
|------|-----------|----------|
| 1 | Tipos TypeScript | `src/types/advbox.ts` |
| 2 | Adicionar ícone Scale ao iconMap | `src/lib/iconMap.ts` |
| 3 | Edge Function `advbox-integration` | `supabase/functions/advbox-integration/index.ts` |
| 4 | Atualizar `db-query` com actions Advbox | `supabase/functions/db-query/index.ts` |
| 5 | Hook `useAdvboxIntegration` | `src/hooks/advbox/useAdvboxIntegration.ts` |
| 6 | Página IntegrationPage + componentes | `src/pages/advbox/IntegrationPage.tsx` |
| 7 | Hook `useNotificationRules` | `src/hooks/advbox/useNotificationRules.ts` |
| 8 | Página NotificationRulesPage + RuleEditor | `src/pages/advbox/NotificationRulesPage.tsx` |
| 9 | Edge Function `advbox-sync` | `supabase/functions/advbox-sync/index.ts` |
| 10 | Página ProcessesPage | `src/pages/advbox/ProcessesPage.tsx` |
| 11 | Edge Function `advbox-notify` | `supabase/functions/advbox-notify/index.ts` |
| 12 | Página LogsPage | `src/pages/advbox/LogsPage.tsx` |
| 13 | Edge Function `advbox-query` | `supabase/functions/advbox-query/index.ts` |
| 14 | Página QueriesPage | `src/pages/advbox/QueriesPage.tsx` |
| 15 | Adicionar rotas ao App.tsx | `src/App.tsx` |
| 16 | Registrar módulo na tabela modules | SQL direto |

---

## Checklist de Validação

- [ ] Testar conexão com Advbox (token válido)
- [ ] Criar regra de notificação e verificar disparo
- [ ] Sincronizar processos e verificar cache
- [ ] Cliente consulta processo via WhatsApp (tool Julia)
- [ ] Histórico de notificações com filtros funcionando
- [ ] Lead cadastrado automaticamente no Advbox
- [ ] Falhas tratadas com mensagens claras

