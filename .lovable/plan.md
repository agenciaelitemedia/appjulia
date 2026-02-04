
# Plano: Adicionar Funcionalidade "Monitorar Agentes"

## Objetivo
Adicionar um botão "Monitorar Agentes" na página de listagem de agentes (`/admin/agentes`) que abre um popup para vincular um usuário a um agente específico na tabela `user_agents`. Esta funcionalidade será restrita a administradores.

---

## Visão Geral da Funcionalidade

O popup terá duas etapas:
1. **Selecionar Usuário**: Busca de usuário existente por nome ou email
2. **Selecionar Agente**: Busca de agente por `cod_agent` ou nome do escritório

Ao confirmar, o sistema cria um vínculo na tabela `user_agents` com o `user_id`, `agent_id` e `cod_agent`.

---

## Layout do Botão

O botão ficará ao lado do botão "Novo Agente":

```text
┌────────────────────────────────────────────────────────────────┐
│                                     [Monitorar] [+ Novo Agente]│
└────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/pages/agents/components/MonitorAgentDialog.tsx` | Criar | Componente do popup com busca de usuário e agente |
| `src/pages/agents/hooks/useAgentSearch.ts` | Criar | Hook para buscar agentes por nome ou cod_agent |
| `src/pages/agents/AgentsList.tsx` | Modificar | Adicionar botão e integrar o dialog |
| `src/lib/externalDb.ts` | Modificar | Adicionar método `searchAgents` |
| `supabase/functions/db-query/index.ts` | Modificar | Adicionar ação `search_agents` |
| `src/types/permissions.ts` | Modificar | Adicionar `admin_agent_monitoring` ao tipo `ModuleCode` |

---

## Detalhamento Técnico

### 1. Nova Ação na Edge Function (`db-query`)

```typescript
case 'search_agents': {
  const { term } = data;
  const searchTerm = `%${term.toLowerCase()}%`;
  result = await sql.unsafe(
    `SELECT 
       a.id,
       a.cod_agent,
       c.name AS client_name,
       c.business_name
     FROM agents a
     JOIN clients c ON c.id = a.client_id
     WHERE a.is_visibilided = true
       AND (
         LOWER(a.cod_agent) LIKE $1 
         OR LOWER(c.name) LIKE $1 
         OR LOWER(c.business_name) LIKE $1
       )
     ORDER BY c.business_name ASC
     LIMIT 20`,
    [searchTerm]
  );
  break;
}
```

### 2. Método no ExternalDb

```typescript
async searchAgents<T = any>(term: string): Promise<T[]> {
  return this.invoke({
    action: 'search_agents',
    data: { term },
  });
}
```

### 3. Hook `useAgentSearch`

```typescript
export interface SearchedAgent {
  id: number;
  cod_agent: string;
  client_name: string;
  business_name: string | null;
}

export function useAgentSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchedAgent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const debouncedTerm = useDebounce(searchTerm, 300);

  const search = useCallback(async (term: string) => {
    if (term.length < 2) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    try {
      const data = await externalDb.searchAgents<SearchedAgent>(term);
      setResults(data);
    } catch (err) {
      console.error('Error searching agents:', err);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    search(debouncedTerm);
  }, [debouncedTerm, search]);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setResults([]);
  }, []);

  return { searchTerm, setSearchTerm, results, isLoading, clearSearch };
}
```

### 4. Componente `MonitorAgentDialog`

O dialog terá 3 estados de visualização:

1. **Seleção de Usuário**: Campo de busca + lista de resultados
2. **Seleção de Agente**: Campo de busca + lista de agentes
3. **Confirmação**: Exibe usuário e agente selecionados com botão "Vincular"

**Estrutura do Dialog**:

```tsx
interface MonitorAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type DialogStep = 'user' | 'agent' | 'confirm';

export function MonitorAgentDialog({ open, onOpenChange, onSuccess }: MonitorAgentDialogProps) {
  const [step, setStep] = useState<DialogStep>('user');
  const [selectedUser, setSelectedUser] = useState<SearchedUser | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<SearchedAgent | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // User search
  const userSearch = useUserSearch();
  
  // Agent search
  const agentSearch = useAgentSearch();

  const handleSubmit = async () => {
    if (!selectedUser || !selectedAgent) return;
    
    setIsSubmitting(true);
    try {
      await externalDb.insertUserAgent(
        selectedUser.id,
        selectedAgent.id,
        selectedAgent.cod_agent
      );
      toast.success('Agente vinculado com sucesso!');
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      toast.error('Erro ao vincular agente');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // ... UI para cada step
}
```

### 5. Integração no AgentsList

```tsx
// Imports
import { MonitorAgentDialog } from './components/MonitorAgentDialog';
import { usePermission } from '@/hooks/usePermission';

// No componente
const { canView } = usePermission();
const canMonitorAgents = canView('admin_agents');
const [showMonitorDialog, setShowMonitorDialog] = useState(false);

// Header com botões
<div className="flex gap-2">
  {canMonitorAgents && (
    <Button variant="outline" onClick={() => setShowMonitorDialog(true)}>
      <Users className="mr-2 h-4 w-4" />
      Monitorar Agentes
    </Button>
  )}
  <Button onClick={() => navigate('/admin/agentes-novo')}>
    <Plus className="mr-2 h-4 w-4" />
    Novo Agente
  </Button>
</div>

// Dialog
{canMonitorAgents && (
  <MonitorAgentDialog
    open={showMonitorDialog}
    onOpenChange={setShowMonitorDialog}
    onSuccess={() => refetch()}
  />
)}
```

### 6. Atualização do Tipo ModuleCode

```typescript
export type ModuleCode =
  | 'dashboard'
  | 'crm_leads'
  // ... outros
  | 'admin_agents'
  | 'admin_agent_monitoring'  // Nova permissão
  | 'admin_products'
  // ...
```

**Nota**: Alternativa é reutilizar `admin_agents` sem criar nova permissão, já que é uma funcionalidade administrativa de agentes.

---

## Fluxo de Uso

1. Admin clica em "Monitorar Agentes"
2. Dialog abre no step "Seleção de Usuário"
3. Admin busca e seleciona um usuário
4. Dialog avança para "Seleção de Agente"
5. Admin busca e seleciona um agente (por código ou nome)
6. Dialog mostra resumo da vinculação
7. Admin confirma e o vínculo é criado na tabela `user_agents`
8. Toast de sucesso e dialog fecha

---

## UI do Dialog

```text
┌─────────────────────────────────────────────────────────────┐
│  Monitorar Agente                                      [X]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Etapa 1 de 3: Selecionar Usuário                          │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🔍 Buscar usuário por nome ou email...              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 👤 João Silva                                        │   │
│  │    joao@empresa.com                              [>] │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ 👤 Maria Santos                                      │   │
│  │    maria@empresa.com                             [>] │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                              [Cancelar]     │
└─────────────────────────────────────────────────────────────┘
```

---

## Validações

1. **Usuário obrigatório**: Não pode avançar sem selecionar usuário
2. **Agente obrigatório**: Não pode confirmar sem selecionar agente
3. **Duplicidade**: A tabela `user_agents` deve ter constraint UNIQUE em (user_id, agent_id) - verificar se já existe

---

## Resultado Esperado

1. Botão "Monitorar Agentes" visível apenas para admins
2. Dialog com fluxo intuitivo em 3 etapas
3. Busca eficiente de usuários e agentes
4. Vínculo criado corretamente na tabela `user_agents`
5. Lista de agentes atualizada após sucesso (refetch)
