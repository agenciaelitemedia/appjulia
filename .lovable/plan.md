
# Plano: Melhorias na Listagem de FollowUp

## Resumo
Refatorar a fila de FollowUp para agrupar registros por agente e WhatsApp (trazendo apenas o mais recente), adicionar ordenação por colunas, atualizar os totalizadores para respeitar todos os filtros, e exibir etapa atual/total com status derivado inteligente.

---

## Alterações por Arquivo

### 1. src/pages/agente/hooks/useFollowupData.ts

**Mudanças na query `useFollowupQueue`:**
- Usar `DISTINCT ON (cod_agent, session_id)` para agrupar e trazer apenas o registro mais recente
- Ordenar por `cod_agent, session_id, send_date DESC` para garantir o mais recente primeiro

**Mudanças na query `useFollowupQueueStats`:**
- Receber `FollowupFiltersState` completo em vez de apenas `agentCodes`
- Aplicar filtros de data e estado na contagem
- Usar mesma lógica de agrupamento `DISTINCT ON` para evitar contagem duplicada

**Nova Query SQL para fila:**
```sql
SELECT DISTINCT ON (cod_agent, session_id)
  id, cod_agent, session_id, step_number, send_date,
  state, history, name_client, created_at, hub, chat_memory
FROM followup_queue
WHERE cod_agent IN ($agentCodes)
  AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $dateFrom
  AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $dateTo
  [AND state = $state]
ORDER BY cod_agent, session_id, send_date DESC
```

**Nova Query SQL para estatisticas:**
```sql
WITH unique_queue AS (
  SELECT DISTINCT ON (cod_agent, session_id)
    cod_agent, session_id, state
  FROM followup_queue
  WHERE cod_agent IN ($agentCodes)
    AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $dateFrom
    AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $dateTo
    [AND state = $state]
  ORDER BY cod_agent, session_id, send_date DESC
)
SELECT state, COUNT(*)::text as count
FROM unique_queue
GROUP BY state
```

---

### 2. src/pages/agente/types.ts

**Adicionar novo tipo para item enriquecido:**
```typescript
export interface FollowupQueueItemEnriched extends FollowupQueueItem {
  total_steps: number;      // Total de etapas configuradas
  derived_status: 'sent' | 'waiting' | 'stopped';  // Status derivado
}
```

---

### 3. src/pages/agente/followup/FollowupPage.tsx

**Mudanças:**
- Passar `filters` completo para `useFollowupQueueStats` em vez de apenas `agentCodes`
- Calcular `total_steps` a partir da configuração do agente (`config.step_cadence`)
- Enriquecer cada item da fila com `total_steps` e `derived_status`
- Passar configuração para o componente `FollowupQueue`

**Lógica de status derivado:**
```typescript
function getDerivedStatus(item: FollowupQueueItem, totalSteps: number): 'sent' | 'waiting' | 'stopped' {
  if (item.state === 'STOP') return 'stopped';
  if (item.state === 'SEND' && item.step_number >= totalSteps) return 'sent';
  return 'waiting'; // QUEUE ou SEND no meio do processo
}
```

---

### 4. src/pages/agente/followup/components/FollowupQueue.tsx

**Adicionar Sistema de Ordenação:**
- Novo estado: `sortField` e `sortDirection`
- Campos ordenáveis: `session_id`, `name_client`, `step_number`, `derived_status`, `send_date`
- Cabeçalhos clicáveis com ícones de ordenação (ArrowUpDown, ArrowUp, ArrowDown)

**Atualizar Coluna de Etapa:**
- Exibir badges estilizados: etapa atual (primário) e total (secundário)
- Formato visual: `[2] / [4]` usando componentes Badge

**Atualizar Coluna de Status:**
- Novo status derivado com cores:
  - `sent` (Enviado): Verde - chegou na última etapa e foi enviado
  - `waiting` (Aguardando): Amarelo - ainda no meio do processo
  - `stopped` (Parado): Cinza - pausado manualmente

**Nova Props:**
```typescript
interface FollowupQueueProps {
  items: FollowupQueueItemEnriched[];  // Atualizado
  // ... resto igual
}
```

**Componente de Badge de Etapa:**
```tsx
function StepBadge({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-1">
      <Badge variant="default" className="text-xs px-2">
        {current}
      </Badge>
      <span className="text-muted-foreground">/</span>
      <Badge variant="outline" className="text-xs px-2">
        {total}
      </Badge>
    </div>
  );
}
```

**Componente de Status Derivado:**
```tsx
const DERIVED_STATUS_CONFIG = {
  sent: { label: 'Enviado', className: 'bg-green-500/10 text-green-600 border-green-500/20' },
  waiting: { label: 'Aguardando', className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  stopped: { label: 'Parado', className: 'bg-muted text-muted-foreground' },
};
```

---

## Fluxo de Dados

```text
FollowupPage
    |
    |-- useFollowupConfig(selectedAgent) -> config
    |-- useFollowupQueue(filters) -> items (agrupados)
    |-- useFollowupQueueStats(filters) -> stats (agrupados + filtrados)
    |
    |-- Calcula total_steps = Object.keys(config.step_cadence).length
    |-- Enriquece items com total_steps e derived_status
    |
    +-- FollowupQueue
    |       |-- items (enriquecidos)
    |       |-- Ordenação client-side
    |       |-- Paginação (20/página)
    |
    +-- FollowupSummary
            |-- stats (reflete filtros)
```

---

## Interface Visual Atualizada

```text
+------------------------------------------------------------------+
| Etapa  | Status     | WhatsApp          | Cliente    | Agendado  |
+--------+------------+-------------------+------------+-----------+
| [2]/[4]| Aguardando | +55 (34) 9999-... | João Silva | 24/01 ... |
| [4]/[4]| Enviado    | +55 (11) 8888-... | Maria ...  | 23/01 ... |
| [1]/[3]| Parado     | +55 (21) 7777-... | Pedro ...  | 22/01 ... |
+------------------------------------------------------------------+
         ^             ^                                  ^
         |             |                                  |
    Clicável      Clicável                           Clicável
    (ordena)      (ordena)                           (ordena)
```

---

## Detalhes Técnicos

### Agrupamento por DISTINCT ON
PostgreSQL permite `DISTINCT ON` que retorna a primeira linha de cada grupo:
```sql
SELECT DISTINCT ON (cod_agent, session_id) *
FROM followup_queue
ORDER BY cod_agent, session_id, send_date DESC
```
Isso garante apenas 1 registro por combinação agente+WhatsApp (o mais recente).

### Ordenação Client-Side
Seguir padrão de `ContratosTable.tsx`:
- Estado `sortField` e `sortDirection`
- `useMemo` para ordenar dados filtrados
- Ícones dinâmicos nos cabeçalhos

### Paginação
- Manter `ITEMS_PER_PAGE = 20`
- Reset para página 1 quando mudar ordenação ou filtros

### Cálculo do Total de Etapas
```typescript
const totalSteps = config?.step_cadence 
  ? Object.keys(parseJsonField(config.step_cadence, {})).length 
  : 3; // fallback
```

---

## Ordem de Implementação

1. **useFollowupData.ts**
   - Atualizar `useFollowupQueue` com `DISTINCT ON`
   - Atualizar `useFollowupQueueStats` para receber filters completos

2. **types.ts**
   - Adicionar `FollowupQueueItemEnriched`

3. **FollowupPage.tsx**
   - Passar filters para stats
   - Calcular e enriquecer items

4. **FollowupQueue.tsx**
   - Adicionar ordenação
   - Atualizar coluna Etapa com badges
   - Atualizar coluna Status com derivado
