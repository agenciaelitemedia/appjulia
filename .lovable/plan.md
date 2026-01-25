
# Recriação da Página de Lista de Agentes `/admin/agentes`

## Visão Geral

Recriar a página de listagem de agentes com layout de tabela, exibindo informações detalhadas sobre cada agente, seu plano, uso de leads e data de vencimento.

---

## Estrutura de Dados

### Tabelas Utilizadas

| Tabela | Propósito |
|--------|-----------|
| `agents` | Dados principais (cod_agent, client_id, agent_plan_id, status, **due_date**, **last_used**) |
| `clients` | Nome do escritório/cliente (name, business_name) |
| `agents_plan` | Detalhes do plano (name, limit) |
| `session` | Sessões de atendimento |
| `log_messages` | Mensagens trocadas pela Julia |

### Campos Atualizados

- **Data de Vencimento**: Campo `due_date` diretamente na tabela `agents`
- **Último Uso**: Campo `last_used` diretamente na tabela `agents`

---

## Colunas da Tabela

| Coluna | Fonte | Descrição |
|--------|-------|-----------|
| **Status** | `agents.status` | Switch para ativar/desativar agente |
| **Cod. Agente** | `agents.cod_agent` | Código identificador |
| **Nome/Escritório** | `agents.name` + `clients.business_name` | Nome do agente e escritório |
| **Plano** | `agents_plan.name` | Nome do plano contratado |
| **Limite/Uso** | Contagem + `agents_plan.limit` | Formato: `leads_recebidos/limite` |
| **Last** | `agents.last_used` | Data do último uso |
| **Venci.** | `agents.due_date` | Data de vencimento |
| **Ação** | - | Menu dropdown com ações |

---

## Alterações Necessárias

### 1. Interface TypeScript

**Arquivo:** `src/pages/agents/AgentsList.tsx`

```typescript
interface AgentListItem {
  id: number;
  cod_agent: string;
  status: 'active' | 'inactive';
  agent_name: string;
  client_name: string;
  business_name: string;
  plan_name: string | null;
  plan_limit: number;
  leads_received: number;
  last_used: string | null;
  due_date: string | null;
}
```

### 2. Query SQL Simplificada

```sql
SELECT 
  a.id,
  a.cod_agent,
  a.status,
  a.name AS agent_name,
  c.name AS client_name,
  c.business_name,
  ap.name AS plan_name,
  COALESCE(ap.limit, 0) AS plan_limit,
  (
    SELECT COUNT(DISTINCT s.id)
    FROM session s
    WHERE s.agent_id = a.id
      AND EXISTS (
        SELECT 1 FROM log_messages lm 
        WHERE lm.session_id = s.id
      )
  ) AS leads_received,
  a.last_used,
  a.due_date
FROM agents a
JOIN clients c ON c.id = a.client_id
LEFT JOIN agents_plan ap ON ap.id = a.agent_plan_id
ORDER BY a.name
```

### 3. Componente da Página

**Arquivo:** `src/pages/agents/AgentsList.tsx`

Estrutura completa:

- **Header**: Título "Agentes IA" + botão "Novo Agente"
- **Tabela**: Componente Table do shadcn/ui
- **Switch**: Toggle de status na primeira coluna
- **Badges coloridos**: 
  - Limite/Uso: verde (ok), amarelo (>80%), vermelho (excedido)
  - Vencimento: verde (>30 dias), amarelo (≤30 dias), vermelho (vencido)
- **Menu de ações**: Configurar, QR Code, Ver conversas, Excluir
- **Paginação**: 20 itens por página

### 4. Helpers de Formatação

```typescript
// Formatar data de vencimento
const formatDueDate = (date: string | null) => {
  if (!date) return '-';
  const dueDate = new Date(date);
  const today = new Date();
  const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return { text: `Dia ${dueDate.getDate()}`, diffDays };
};

// Cor do badge de vencimento
const getDueDateColor = (diffDays: number) => {
  if (diffDays < 0) return 'bg-red-500';
  if (diffDays <= 30) return 'bg-yellow-500';
  return 'bg-green-500';
};

// Cor do badge de uso
const getUsageColor = (used: number, limit: number) => {
  const percentage = (used / limit) * 100;
  if (percentage >= 100) return 'bg-red-500';
  if (percentage >= 80) return 'bg-yellow-500';
  return 'bg-green-500';
};
```

---

## Estados da Interface

| Estado | Comportamento |
|--------|---------------|
| **Loading** | Skeleton na tabela (5 linhas) |
| **Vazio** | Card com ícone Bot e botão "Criar Agente" |
| **Erro** | Toast de erro |

---

## Funcionalidades do Menu de Ações

- **Configurar** → `/agente/personalizacao?id={agent_id}`
- **QR Code** → Modal com QR Code
- **Ver conversas** → Histórico de conversas
- **Excluir** → Confirmação + remoção

---

## Resumo Técnico

| Item | Detalhes |
|------|----------|
| **Arquivo** | `src/pages/agents/AgentsList.tsx` |
| **Componentes** | Table, Badge, Switch, DropdownMenu, Skeleton |
| **Query** | `externalDb.raw()` |
| **Paginação** | Client-side, 20 itens/página |
| **Ordenação** | Client-side |
| **Campos da agents** | `due_date` (vencimento), `last_used` (último uso) |
