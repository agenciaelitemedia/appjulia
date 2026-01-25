
# Melhorias na Listagem de Agentes `/admin/agentes`

## Visão Geral

Implementar melhorias de UX na página de listagem de agentes incluindo campo de busca, confirmação de status, ordenação de colunas e ajustes visuais.

---

## Alterações Necessárias

### 1. Campo de Busca

Adicionar um campo `Input` para filtrar agentes por nome do cliente ou escritório acima da tabela.

**Implementação:**
- Novo estado: `searchTerm`
- Filtrar `agents` pelo `business_name` ou `client_name` contendo o termo de busca
- Posicionado entre o header e a tabela

```typescript
const [searchTerm, setSearchTerm] = useState('');

const filteredAgents = useMemo(() => {
  if (!searchTerm.trim()) return agents;
  const term = searchTerm.toLowerCase();
  return agents.filter(agent =>
    agent.business_name?.toLowerCase().includes(term) ||
    agent.client_name?.toLowerCase().includes(term) ||
    agent.cod_agent?.toLowerCase().includes(term)
  );
}, [agents, searchTerm]);
```

---

### 2. Confirmação de Ativação/Desativação

Adicionar `AlertDialog` para confirmar antes de alterar o status do agente.

**Implementação:**
- Novo estado: `agentToToggle` (armazena o agente selecionado)
- Ao clicar no Switch, abre o dialog de confirmação
- Mensagem dinâmica: "Deseja ativar/desativar o agente X?"

```typescript
const [agentToToggle, setAgentToToggle] = useState<AgentListItem | null>(null);

// No Switch:
onCheckedChange={() => setAgentToToggle(agent)}

// Dialog:
<AlertDialog open={!!agentToToggle} onOpenChange={() => setAgentToToggle(null)}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>
        {agentToToggle?.status === 'active' ? 'Desativar' : 'Ativar'} agente?
      </AlertDialogTitle>
      <AlertDialogDescription>
        O agente {agentToToggle?.business_name || agentToToggle?.client_name} será 
        {agentToToggle?.status === 'active' ? ' desativado' : ' ativado'}.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancelar</AlertDialogCancel>
      <AlertDialogAction onClick={() => confirmToggle()}>
        Confirmar
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

### 3. Ordenação de Colunas

Adicionar ordenação clicável em todas as colunas relevantes.

**Implementação:**
- Novo estado: `sortConfig` com `key` e `direction`
- Ícone `ArrowUpDown` ou `ArrowUp`/`ArrowDown` nos cabeçalhos
- Ordenação client-side

```typescript
type SortKey = 'status' | 'cod_agent' | 'business_name' | 'plan_name' | 'leads_received' | 'last_used' | 'due_date';

const [sortConfig, setSortConfig] = useState<{
  key: SortKey;
  direction: 'asc' | 'desc';
}>({ key: 'business_name', direction: 'asc' });

const sortedAgents = useMemo(() => {
  const sorted = [...filteredAgents].sort((a, b) => {
    // Lógica de comparação baseada na key
  });
  return sortConfig.direction === 'desc' ? sorted.reverse() : sorted;
}, [filteredAgents, sortConfig]);
```

**Colunas ordenáveis:**
| Coluna | Campo de ordenação |
|--------|-------------------|
| Status | `status` |
| Cod. Agente | `cod_agent` |
| Nome/Escritório | `business_name` |
| Plano | `plan_name` |
| Limite/Uso | `leads_received` |
| Last | `last_used` |
| Venci. | `due_date` |

---

### 4. Ícone de Editar nas Ações

Trocar o ícone `MoreHorizontal` por `Pencil` (ícone de editar) na coluna de ações.

**Alteração:**
```tsx
// De:
import { MoreHorizontal } from 'lucide-react';
<MoreHorizontal className="h-4 w-4" />

// Para:
import { Pencil } from 'lucide-react';
<Pencil className="h-4 w-4" />
```

---

## Novos Imports Necessários

```typescript
import { 
  ArrowUpDown,  // ou ArrowUp, ArrowDown
  Pencil,
  Search 
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
```

---

## Novos Estados

| Estado | Tipo | Propósito |
|--------|------|-----------|
| `searchTerm` | `string` | Termo de busca |
| `agentToToggle` | `AgentListItem \| null` | Agente para confirmação de toggle |
| `sortConfig` | `{ key, direction }` | Configuração de ordenação |

---

## Fluxo de Dados Atualizado

```text
agents (dados brutos)
      │
      ▼
filteredAgents (aplicar searchTerm)
      │
      ▼
sortedAgents (aplicar sortConfig)
      │
      ▼
paginatedAgents (aplicar paginação)
      │
      ▼
Renderização na tabela
```

---

## Layout do Campo de Busca

Posicionado abaixo do header e acima da Card da tabela:

```tsx
<div className="flex items-center gap-4">
  <div className="relative flex-1 max-w-sm">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
    <Input
      placeholder="Buscar por nome ou código..."
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      className="pl-9"
    />
  </div>
</div>
```

---

## Resumo das Alterações

| Funcionalidade | Componentes |
|----------------|-------------|
| Campo de busca | `Input` + ícone `Search` |
| Confirmação de status | `AlertDialog` |
| Ordenação de colunas | Estados + ícone `ArrowUpDown` |
| Ícone de editar | `Pencil` substituindo `MoreHorizontal` |
