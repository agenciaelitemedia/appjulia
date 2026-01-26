
# Plano de Implementacao: Pagina de Detalhes do Agente

## Resumo
Criar uma pagina dedicada para visualizar todos os detalhes de um agente, acessivel apos a criacao de um novo agente e tambem atraves de um icone de visualizacao na listagem.

---

## Diagrama do Fluxo

```text
+------------------+     +------------------+     +------------------+
|  CRIAR AGENTE    | --> |  REDIRECIONAR    | --> |  PAGINA DETALHES |
|  (Wizard)        |     |  com agent_id    |     |  /admin/agentes/ |
|                  |     |                  |     |  :id/detalhes    |
+------------------+     +------------------+     +------------------+

+------------------+     +------------------+
|  LISTAGEM        | --> |  PAGINA DETALHES |
|  (Icone Eye)     |     |  /admin/agentes/ |
|                  |     |  :id/detalhes    |
+------------------+     +------------------+
```

---

## Estrutura da Pagina de Detalhes

### Layout Principal
```text
+----------------------------------------------------------+
| [<- Voltar a listagem]                                    |
+----------------------------------------------------------+
|                                                           |
| BLOCO 1: DADOS DE ACESSO                                  |
| +-------------------------------------------------------+ |
| | Usuario: email@exemplo.com                            | |
| | Senha:   Julia@1234   [Copiar]                        | |
| |   (ou)  ••••••••••  (quando remember_token nulo)      | |
| +-------------------------------------------------------+ |
|                                                           |
| BLOCO 2: INFORMACOES DO AGENTE                           |
| +-------------------------------------------------------+ |
| | Codigo:     202501001                                 | |
| | Status:     Ativo                                     | |
| | Modo Closer: Sim/Nao                                  | |
| +-------------------------------------------------------+ |
|                                                           |
| BLOCO 3: DADOS DO CLIENTE                                |
| +-------------------------------------------------------+ |
| | Nome:           Joao Silva                            | |
| | Razao Social:   Empresa LTDA                          | |
| | CPF/CNPJ:       12.345.678/0001-90                    | |
| | Email:          cliente@email.com                     | |
| | Telefone:       (11) 99999-9999                       | |
| | Endereco:       Rua X, 123 - Bairro - Cidade/UF      | |
| +-------------------------------------------------------+ |
|                                                           |
| BLOCO 4: PLANO E LIMITES                                 |
| +-------------------------------------------------------+ |
| | Plano:          Premium                               | |
| | Limite Leads:   100                                   | |
| | Dia Vencimento: 15                                    | |
| | Uso Atual:      45/100                               | |
| +-------------------------------------------------------+ |
|                                                           |
| BLOCO 5: CONFIGURACOES (JSON)                            |
| +-------------------------------------------------------+ |
| | { "key": "value", ... }                              | |
| +-------------------------------------------------------+ |
|                                                           |
| BLOCO 6: PROMPT DO SISTEMA                               |
| +-------------------------------------------------------+ |
| | Voce e um assistente virtual...                      | |
| +-------------------------------------------------------+ |
|                                                           |
| [<- Voltar a listagem]                                    |
+----------------------------------------------------------+
```

---

## Arquivos a Criar

### 1. `src/pages/agents/AgentDetailsPage.tsx`
Componente principal da pagina de detalhes contendo:
- Botao "Voltar a listagem" no topo
- 6 blocos de informacoes conforme layout
- Carregamento dos dados do agente via endpoint dedicado
- Tratamento de loading e erro

### 2. Endpoint `get_agent_details` na Edge Function
Query SQL que retorna todos os dados necessarios em uma unica chamada:
- Dados do agente (agents)
- Dados do cliente vinculado (clients)
- Dados do usuario vinculado (users via user_agents)
- Dados do plano (agents_plan)
- Contagem de leads do mes atual

---

## Arquivos a Modificar

### 1. `supabase/functions/db-query/index.ts`
Adicionar novo case `get_agent_details`:

```sql
SELECT 
  a.id,
  a.cod_agent,
  a.status,
  a.is_closer,
  a.settings,
  a.prompt,
  a.due_date,
  a.created_at,
  -- Cliente
  c.id as client_id,
  c.name as client_name,
  c.business_name,
  c.federal_id,
  c.email as client_email,
  c.phone as client_phone,
  c.zip_code,
  c.street,
  c.street_number,
  c.complement,
  c.neighborhood,
  c.city,
  c.state,
  -- Plano
  ap.id as plan_id,
  ap.name as plan_name,
  ap."limit" as plan_limit,
  -- Usuario
  u.id as user_id,
  u.name as user_name,
  u.email as user_email,
  u.remember_token,
  -- Leads do mes
  (SELECT COUNT(DISTINCT s.id) FROM sessions s 
   WHERE s.agent_id = a.id 
   AND EXISTS (SELECT 1 FROM log_messages lm 
               WHERE lm.session_id = s.id 
               AND lm.created_at >= DATE_TRUNC('month', CURRENT_DATE))) as leads_received
FROM agents a
JOIN clients c ON c.id = a.client_id
LEFT JOIN agents_plan ap ON ap.id = a.agent_plan_id
LEFT JOIN user_agents ua ON ua.agent_id = a.id
LEFT JOIN users u ON u.id = ua.user_id
WHERE a.id = $1
LIMIT 1
```

### 2. `src/lib/externalDb.ts`
Adicionar metodo `getAgentDetails(agentId: number)`:

```typescript
async getAgentDetails<T = any>(agentId: number): Promise<T | null> {
  const result = await this.invoke({
    action: 'get_agent_details',
    data: { agentId },
  });
  return result.length > 0 ? result[0] : null;
}
```

### 3. `src/App.tsx`
Adicionar nova rota:

```typescript
import AgentDetailsPage from './pages/agents/AgentDetailsPage';

// Dentro das rotas admin
<Route path="/admin/agentes/:id/detalhes" element={<AgentDetailsPage />} />
```

### 4. `src/pages/agents/AgentsList.tsx`
Adicionar icone Eye no dropdown de acoes:

```typescript
import { Eye } from 'lucide-react';

// No DropdownMenu, adicionar como primeiro item:
<DropdownMenuItem onClick={() => navigate(`/admin/agentes/${agent.id}/detalhes`)}>
  <Eye className="mr-2 h-4 w-4" />
  Visualizar
</DropdownMenuItem>
```

### 5. `src/pages/agents/components/CreateAgentWizard.tsx`
Alterar redirecionamento apos sucesso:

```typescript
// Antes:
navigate('/admin/agentes');

// Depois:
navigate(`/admin/agentes/${result.agentId}/detalhes`);
```

Passar senha temporaria via state para exibir na pagina de detalhes:

```typescript
navigate(`/admin/agentes/${result.agentId}/detalhes`, {
  state: { tempPassword: result.tempPassword }
});
```

---

## Detalhes Tecnicos

### Bloco de Dados de Acesso - Logica da Senha

```typescript
// No componente AgentDetailsPage:
const userEmail = agentDetails?.user_email;
const rememberToken = agentDetails?.remember_token;

// Senha vinda do wizard (para novos agentes)
const location = useLocation();
const tempPasswordFromState = location.state?.tempPassword;

// Determinar qual senha mostrar
const passwordToShow = tempPasswordFromState || rememberToken;
const hasPassword = Boolean(passwordToShow);

// Renderizacao:
{hasPassword ? (
  <div className="flex items-center gap-2">
    <span className="font-mono">{passwordToShow}</span>
    <Button variant="ghost" size="sm" onClick={copyPassword}>
      <Copy className="h-4 w-4" />
    </Button>
  </div>
) : (
  <span className="font-mono text-muted-foreground">••••••••••</span>
)}
```

### Interface de Tipos

```typescript
interface AgentDetails {
  // Agente
  id: number;
  cod_agent: string;
  status: boolean;
  is_closer: boolean;
  settings: string;
  prompt: string;
  due_date: number;
  created_at: string;
  
  // Cliente
  client_id: number;
  client_name: string;
  business_name: string | null;
  federal_id: string | null;
  client_email: string | null;
  client_phone: string | null;
  zip_code: string | null;
  street: string | null;
  street_number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  
  // Plano
  plan_id: number | null;
  plan_name: string | null;
  plan_limit: number;
  
  // Usuario
  user_id: number | null;
  user_name: string | null;
  user_email: string | null;
  remember_token: string | null;
  
  // Metricas
  leads_received: number;
}
```

### Componentes UI Utilizados
- Card, CardHeader, CardTitle, CardContent (blocos)
- Badge (status, modo closer)
- Button (voltar, copiar)
- Skeleton (loading)
- ScrollArea (para JSON e prompt extensos)

---

## Ordem de Implementacao

1. Adicionar endpoint `get_agent_details` na Edge Function
2. Adicionar metodo `getAgentDetails` no externalDb.ts
3. Criar componente `AgentDetailsPage.tsx`
4. Registrar nova rota no App.tsx
5. Adicionar icone Eye na listagem de agentes
6. Alterar redirecionamento do Wizard apos sucesso
7. Testar fluxo completo

---

## Cenarios de Teste

| Cenario | Esperado |
|---------|----------|
| Criar novo agente com novo usuario | Redireciona para detalhes, mostra senha temporaria |
| Criar novo agente com usuario existente | Redireciona para detalhes, mostra mascara na senha |
| Clicar Eye na listagem | Abre pagina de detalhes do agente |
| Agente sem plano | Exibe "Sem plano" no bloco de planos |
| Agente sem usuario | Exibe campos de usuario vazios |
| Botao Voltar | Retorna para /admin/agentes |
