
# Plano: Migrar Advbox de agent_id para cod_agent

## Resumo Executivo

Migrar o módulo Advbox para usar `cod_agent` (string) como identificador principal em vez de `agent_id` (integer), garantindo consistência com o restante do sistema (CRM, Dashboard, FollowUp) e permitindo que usuários com vínculos "monitorados" (que possuem apenas `cod_agent` sem `agent_id`) também possam configurar a integração.

## Problema Atual

| Situação | Descrição |
|----------|-----------|
| Advbox atual | Usa `agent_id` (integer) como chave primária/foreign key |
| Outros módulos | CRM, Dashboard, FollowUp usam `cod_agent` (string) |
| Impacto | Usuários com vínculo "monitorado" (apenas `cod_agent`, sem `agent_id`) não conseguem configurar Advbox |

## Arquivos Afetados

### 1. Tipos TypeScript
- `src/types/advbox.ts`

### 2. Edge Functions (4 arquivos)
- `supabase/functions/advbox-integration/index.ts`
- `supabase/functions/advbox-sync/index.ts`
- `supabase/functions/advbox-notify/index.ts`
- `supabase/functions/advbox-query/index.ts`

### 3. Hooks (5 arquivos)
- `src/hooks/advbox/useAdvboxIntegration.ts`
- `src/hooks/advbox/useNotificationRules.ts`
- `src/hooks/advbox/useProcessesCache.ts`
- `src/hooks/advbox/useNotificationLogs.ts`
- `src/hooks/advbox/useClientQueries.ts`

### 4. Componentes UI
- `src/components/advbox/AdvboxAgentSelect.tsx`

### 5. Páginas (5 arquivos)
- `src/pages/advbox/IntegrationPage.tsx`
- `src/pages/advbox/NotificationRulesPage.tsx`
- `src/pages/advbox/ProcessesPage.tsx`
- `src/pages/advbox/LogsPage.tsx`
- `src/pages/advbox/QueriesPage.tsx`

---

## Detalhes Técnicos

### Fase 1: Atualizar Tipos TypeScript

**Arquivo:** `src/types/advbox.ts`

Alterar todos os tipos que usam `agent_id: number` para `cod_agent: string`:

```typescript
// ANTES
export interface AdvboxIntegration {
  agent_id: number;
  // ...
}

// DEPOIS
export interface AdvboxIntegration {
  cod_agent: string;
  // ...
}
```

Tipos afetados:
- `AdvboxIntegration`
- `AdvboxNotificationRule`
- `AdvboxProcess`
- `AdvboxNotificationLog`
- `AdvboxClientQuery`
- `AdvboxLeadSync`

---

### Fase 2: Atualizar Componente AdvboxAgentSelect

**Arquivo:** `src/components/advbox/AdvboxAgentSelect.tsx`

Alterações:
1. Mudar `value` de `number | null` para `string | null`
2. Mudar `onValueChange` de `(agentId: number | null)` para `(codAgent: string | null)`
3. Usar `cod_agent` como chave de seleção (já disponível na query)

```typescript
// ANTES
interface AdvboxAgentSelectProps {
  value: number | null;
  onValueChange: (agentId: number | null) => void;
}

// DEPOIS
interface AdvboxAgentSelectProps {
  value: string | null;
  onValueChange: (codAgent: string | null) => void;
}
```

---

### Fase 3: Atualizar Edge Functions

#### 3.1 advbox-integration/index.ts

Substituir todas as referências:
- `agentId` (parâmetro) → `codAgent`
- `agent_id = $1` → `cod_agent = $1`
- Queries SQL: `WHERE agent_id = $1` → `WHERE cod_agent = $1`
- UPSERT conflict: `ON CONFLICT (agent_id)` → `ON CONFLICT (cod_agent)`

#### 3.2 advbox-sync/index.ts

Mesmas substituições:
- Parâmetro de entrada: `agentId` → `codAgent`
- Todas as queries SQL usando `agent_id` → `cod_agent`

#### 3.3 advbox-notify/index.ts

Substituições:
- `agent_id` nos parâmetros → `cod_agent`
- Queries de busca e insert

#### 3.4 advbox-query/index.ts

Substituições:
- `agent_id` → `cod_agent` em todas as queries

---

### Fase 4: Atualizar Hooks

#### 4.1 useAdvboxIntegration.ts

```typescript
// ANTES
loadIntegration: (agentId: number) => Promise<void>;
saveIntegration: (agentId: number, data: AdvboxIntegrationFormData) => Promise<boolean>;

// DEPOIS
loadIntegration: (codAgent: string) => Promise<void>;
saveIntegration: (codAgent: string, data: AdvboxIntegrationFormData) => Promise<boolean>;
```

#### 4.2 useNotificationRules.ts

```typescript
// ANTES
loadRules: (agentId: number) => Promise<void>;
saveRule: (agentId: number, integrationId: string, data, ruleId?) => Promise<boolean>;

// DEPOIS
loadRules: (codAgent: string) => Promise<void>;
saveRule: (codAgent: string, integrationId: string, data, ruleId?) => Promise<boolean>;
```

#### 4.3 useProcessesCache.ts

```typescript
// ANTES
loadProcesses: (agentId: number, filters?) => Promise<void>;
syncProcesses: (agentId: number) => Promise<{...}>;

// DEPOIS
loadProcesses: (codAgent: string, filters?) => Promise<void>;
syncProcesses: (codAgent: string) => Promise<{...}>;
```

#### 4.4 useNotificationLogs.ts

```typescript
// ANTES
loadLogs: (agentId: number, filters) => Promise<void>;

// DEPOIS
loadLogs: (codAgent: string, filters) => Promise<void>;
```

#### 4.5 useClientQueries.ts

```typescript
// ANTES
loadQueries: (agentId: number, filters) => Promise<void>;

// DEPOIS
loadQueries: (codAgent: string, filters) => Promise<void>;
```

---

### Fase 5: Atualizar Páginas

Todas as 5 páginas seguem o mesmo padrão:

```typescript
// ANTES
const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
loadIntegration(selectedAgentId);

// DEPOIS
const [selectedCodAgent, setSelectedCodAgent] = useState<string | null>(null);
loadIntegration(selectedCodAgent);
```

Páginas afetadas:
- `IntegrationPage.tsx`
- `NotificationRulesPage.tsx`
- `ProcessesPage.tsx`
- `LogsPage.tsx`
- `QueriesPage.tsx`

---

### Fase 6: Atualizar Tabelas do Banco Externo

**Importante:** As tabelas Advbox estão no banco externo PostgreSQL.

Script SQL de migração a ser executado manualmente:

```sql
-- 1. Adicionar coluna cod_agent às tabelas
ALTER TABLE advbox_integrations 
  ADD COLUMN IF NOT EXISTS cod_agent TEXT;

-- 2. Popular cod_agent usando a tabela agents
UPDATE advbox_integrations ai
SET cod_agent = a.cod_agent::text
FROM agents a
WHERE ai.agent_id = a.id;

-- 3. Tornar cod_agent NOT NULL e criar índice único
ALTER TABLE advbox_integrations 
  ALTER COLUMN cod_agent SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_advbox_integrations_cod_agent 
  ON advbox_integrations(cod_agent);

-- 4. Remover constraint antiga e criar nova
ALTER TABLE advbox_integrations 
  DROP CONSTRAINT IF EXISTS advbox_integrations_agent_id_key;

-- Repetir para as outras 5 tabelas:
-- advbox_notification_rules
-- advbox_processes_cache
-- advbox_notification_logs
-- advbox_client_queries
-- advbox_lead_sync
```

---

## Ordem de Implementação

| # | Etapa | Tipo |
|---|-------|------|
| 1 | Atualizar `src/types/advbox.ts` | Tipos |
| 2 | Atualizar `AdvboxAgentSelect.tsx` | Componente |
| 3 | Atualizar 4 Edge Functions | Backend |
| 4 | Atualizar 5 Hooks | Lógica |
| 5 | Atualizar 5 Páginas | UI |
| 6 | Executar SQL no banco externo (manual) | Banco |
| 7 | Testar fluxo completo | Validação |

---

## Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Dados existentes com agent_id | Script SQL popula cod_agent antes de remover agent_id |
| Incompatibilidade de tipos | Migrar tipos primeiro, depois código |
| Downtime durante migração | Manter ambas colunas temporariamente até validação |

---

## Resultado Esperado

Após a migração:
- Usuários com vínculo completo (`agent_id` + `cod_agent`) funcionam normalmente
- Usuários com vínculo monitorado (apenas `cod_agent`) podem configurar Advbox
- Consistência com CRM, Dashboard, FollowUp e outros módulos
- Queries unificadas usando `cod_agent` como identificador único
