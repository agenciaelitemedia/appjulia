
# Implementação do Wizard de Criação de Agentes - Versão Completa

## Visão Geral

Refatoração completa do wizard de criação de agentes com funcionalidades reais de busca no banco de dados, geração automática de código do agente e melhor experiência do usuário seguindo as referências visuais fornecidas.

---

## Alterações de Rota

| De | Para |
|---|---|
| `/admin/agentes/novo` | `/admin/agentes-novo` |

**Arquivo:** `src/App.tsx`

---

## Aba 1: Cliente (Refatoração Completa)

### Estados da Interface

```text
1. ESTADO INICIAL (Busca)
   ┌─────────────────────────────────────────────────────────┐
   │  🔍 [Buscar cliente por nome, escritório ou email...]  │
   │                                          [+ Novo Cliente]│
   ├─────────────────────────────────────────────────────────┤
   │                                                          │
   │                      🔍                                  │
   │         Busque um cliente existente                     │
   │     ou clique em "Novo Cliente" para cadastrar          │
   │                                                          │
   └─────────────────────────────────────────────────────────┘

2. ESTADO PESQUISANDO (após 3 caracteres)
   ┌─────────────────────────────────────────────────────────┐
   │  🔍 [mario                                    x]        │
   │                                          [+ Novo Cliente]│
   ├─────────────────────────────────────────────────────────┤
   │  11 cliente(s) encontrado(s)                            │
   ├─────────────────────────────────────────────────────────┤
   │  👤 Mario Lucas Malheiros                           >   │
   │     🏢 Lucas Malheiros Advogados Associados             │
   ├─────────────────────────────────────────────────────────┤
   │  👤 Mario_new_v8                                    >   │
   │     🏢 Mario_new_v8                                     │
   ├─────────────────────────────────────────────────────────┤
   │  👤 Mario V8 - Abril 2025                           >   │
   │     🏢 Mario V8 · 20258888@atendejulia.com.br          │
   └─────────────────────────────────────────────────────────┘

3. ESTADO CLIENTE SELECIONADO
   ┌─────────────────────────────────────────────────────────┐
   │  ┌─────────────────────────────────────────┐  x Trocar  │
   │  │ 👤 Mario_new_v8                         │            │
   │  └─────────────────────────────────────────┘            │
   ├─────────────────────────────────────────────────────────┤
   │  Código do Agente          É Closer?                    │
   │  ┌────────────────┐        ○ Não                        │
   │  │ 202601003      │ (readonly)                          │
   │  └────────────────┘                                     │
   └─────────────────────────────────────────────────────────┘

4. ESTADO NOVO CLIENTE
   ┌─────────────────────────────────────────────────────────┐
   │  [Novo Cliente]                               x Cancelar │
   ├─────────────────────────────────────────────────────────┤
   │  Nome *                    Escritório                   │
   │  [_____________________]   [_____________________]      │
   │                                                          │
   │  CPF/CNPJ                  Email *                      │
   │  [000.000.000-00_______]   [email@exemplo.com______]    │
   │                                                          │
   │  Telefone *                                              │
   │  [BR +55 ▼] [(00) 00000-0000_______]                    │
   │                                                          │
   │  CEP *            Logradouro                            │
   │  [00000-000 🔍]   [________________________]            │
   │                                                          │
   │  Número           Complemento        Bairro             │
   │  [______]         [____________]     [___________]      │
   │                                                          │
   │  Cidade           Estado                                │
   │  [____________]   [UF]                                  │
   └─────────────────────────────────────────────────────────┘
```

### Geração Automática do Código do Agente

**Regra:** `YYYYMM` + `NNN` (sequencial no mês)

**Query para obter próximo código:**
```sql
SELECT COALESCE(
  MAX(CAST(SUBSTRING(cod_agent FROM 7) AS INTEGER)),
  0
) + 1 as next_seq
FROM agents
WHERE cod_agent LIKE '202601%'
```

**Exemplo:** Se existem agentes `202601001`, `202601002`, `202601003`, o próximo será `202601004`

### Busca de Clientes

**Trigger:** Após digitar 3+ caracteres
**Debounce:** 300ms
**Query:**
```sql
SELECT id, name, business_name, email, phone
FROM clients
WHERE 
  LOWER(name) LIKE LOWER('%termo%') OR
  LOWER(business_name) LIKE LOWER('%termo%') OR
  LOWER(email) LIKE LOWER('%termo%')
ORDER BY name ASC
LIMIT 20
```

### Campos do Novo Cliente

Mesmos campos do Profile com as mesmas máscaras:

| Campo | Tipo | Máscara | Obrigatório |
|-------|------|---------|-------------|
| name | Input | - | Sim |
| business_name | Input | - | Não |
| federal_id | Input | maskCPFCNPJ | Não |
| email | Input | - | Sim |
| phone | Input | maskPhone | Sim |
| zip_code | Input | maskCEP | Sim |
| street | Input | - | - (auto-preenchido) |
| street_number | Input | - | Não |
| complement | Input | - | Não |
| neighborhood | Input | - | - (auto-preenchido) |
| city | Input | - | - (auto-preenchido) |
| state | Input | - | - (auto-preenchido) |

### Busca Automática de CEP

- OnBlur do campo CEP quando tiver 8 dígitos
- Consulta à API ViaCEP: `https://viacep.com.br/ws/{cep}/json/`
- Auto-preenche: logradouro, bairro, cidade, estado

---

## Aba 2: Planos (Ajustes)

### Carregamento de Planos do Banco

**Query:**
```sql
SELECT id, name, leads_limit, price
FROM agents_plan
WHERE is_active = true
ORDER BY price ASC
```

### Comportamento

1. Ao selecionar um plano, o campo "Limite de Leads" é preenchido automaticamente com o `leads_limit` do plano
2. Usuário pode alterar manualmente o limite (override)
3. Dia do vencimento inicia com o dia atual do mês

### Layout

```text
┌─────────────────────────────────────────────────────────────┐
│  Plano *                                                    │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Selecione um plano                               ▼    │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  Limite de Leads          Dia do Vencimento *              │
│  ┌────────────────┐       ┌────────────────┐               │
│  │ 500            │       │ 25             │  (1-31)       │
│  └────────────────┘       └────────────────┘               │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Resumo do Plano                                      │  │
│  │ Plano: Profissional                                  │  │
│  │ Limite base: 500 leads/mês                           │  │
│  │ Valor: R$ 297,00                                     │  │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Aba 3: Configurações

Permanece igual (editor JSON).

---

## Aba 4: Prompt

Permanece igual (textarea com contador de palavras).

---

## Aba 5: Usuário (Renomeada de CRM)

### Estados da Interface

```text
1. ESTADO INICIAL (Busca)
   ┌─────────────────────────────────────────────────────────┐
   │  🔍 [Buscar usuário por nome ou email...]              │
   │                                          [+ Novo Usuário]│
   ├─────────────────────────────────────────────────────────┤
   │                                                          │
   │                      👤                                  │
   │         Busque um usuário existente                     │
   │     ou clique em "Novo Usuário" para cadastrar          │
   │                                                          │
   └─────────────────────────────────────────────────────────┘

2. ESTADO USUÁRIO SELECIONADO
   ┌─────────────────────────────────────────────────────────┐
   │  ┌─────────────────────────────────────────┐  x Trocar  │
   │  │ 👤 João Silva                            │            │
   │  │    joao@empresa.com                     │            │
   │  └─────────────────────────────────────────┘            │
   └─────────────────────────────────────────────────────────┘

3. ESTADO NOVO USUÁRIO
   ┌─────────────────────────────────────────────────────────┐
   │  [Novo Usuário]                               x Cancelar │
   ├─────────────────────────────────────────────────────────┤
   │  Nome *                                                  │
   │  [_____________________]                                │
   │                                                          │
   │  Email *  (pré-preenchido da aba Cliente)               │
   │  [cliente@email.com_____________]                       │
   └─────────────────────────────────────────────────────────┘
```

### Busca de Usuários

**Query:**
```sql
SELECT id, name, email, role
FROM users
WHERE 
  LOWER(name) LIKE LOWER('%termo%') OR
  LOWER(email) LIKE LOWER('%termo%')
ORDER BY name ASC
LIMIT 20
```

---

## Arquivos a Modificar/Criar

### Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/App.tsx` | Alterar rota para `/admin/agentes-novo` |
| `src/pages/agents/CreateAgentPage.tsx` | Atualizar link de retorno |
| `src/pages/agents/components/CreateAgentWizard.tsx` | Expandir AgentFormData, renomear aba CRM para Usuário |
| `src/pages/agents/components/wizard-steps/ClientStep.tsx` | Refatoração completa com busca real |
| `src/pages/agents/components/wizard-steps/PlanStep.tsx` | Carregar planos do banco |
| `src/pages/agents/components/wizard-steps/CRMStep.tsx` | Renomear para UserStep e implementar busca |

### Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/agents/hooks/useAgentCode.ts` | Hook para gerar código do agente |
| `src/pages/agents/hooks/useClientSearch.ts` | Hook para busca de clientes |
| `src/pages/agents/hooks/useUserSearch.ts` | Hook para busca de usuários |
| `src/pages/agents/hooks/usePlans.ts` | Hook para carregar planos |

---

## Novos Endpoints no Edge Function

Adicionar ações ao `db-query/index.ts`:

### search_clients
```typescript
case 'search_clients': {
  const { term } = data;
  const searchTerm = `%${term.toLowerCase()}%`;
  result = await sql.unsafe(
    `SELECT id, name, business_name, email, phone
     FROM clients
     WHERE LOWER(name) LIKE $1 
        OR LOWER(business_name) LIKE $1 
        OR LOWER(email) LIKE $1
     ORDER BY name ASC
     LIMIT 20`,
    [searchTerm]
  );
  break;
}
```

### search_users
```typescript
case 'search_users': {
  const { term } = data;
  const searchTerm = `%${term.toLowerCase()}%`;
  result = await sql.unsafe(
    `SELECT id, name, email, role
     FROM users
     WHERE LOWER(name) LIKE $1 OR LOWER(email) LIKE $1
     ORDER BY name ASC
     LIMIT 20`,
    [searchTerm]
  );
  break;
}
```

### get_next_agent_code
```typescript
case 'get_next_agent_code': {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `${year}${month}`;
  
  const rows = await sql.unsafe(
    `SELECT COALESCE(
       MAX(CAST(SUBSTRING(cod_agent FROM 7) AS INTEGER)),
       0
     ) + 1 as next_seq
     FROM agents
     WHERE cod_agent LIKE $1`,
    [`${prefix}%`]
  );
  
  const nextSeq = String(rows[0].next_seq).padStart(3, '0');
  result = [{ cod_agent: `${prefix}${nextSeq}` }];
  break;
}
```

### get_plans
```typescript
case 'get_plans': {
  result = await sql.unsafe(
    `SELECT id, name, leads_limit, price
     FROM agents_plan
     WHERE is_active = true
     ORDER BY price ASC`
  );
  break;
}
```

### insert_client
```typescript
case 'insert_client': {
  const { clientData } = data;
  const columns = Object.keys(clientData).join(', ');
  const values = Object.values(clientData);
  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
  
  result = await sql.unsafe(
    `INSERT INTO clients (${columns}, created_at, updated_at) 
     VALUES (${placeholders}, now(), now()) 
     RETURNING *`,
    values
  );
  break;
}
```

---

## Atualização do externalDb.ts

```typescript
// Novos métodos
async searchClients<T = any>(term: string): Promise<T[]> {
  return this.invoke({
    action: 'search_clients',
    data: { term },
  });
}

async searchUsers<T = any>(term: string): Promise<T[]> {
  return this.invoke({
    action: 'search_users',
    data: { term },
  });
}

async getNextAgentCode(): Promise<string> {
  const result = await this.invoke({
    action: 'get_next_agent_code',
    data: {},
  });
  return result[0].cod_agent;
}

async getPlans<T = any>(): Promise<T[]> {
  return this.invoke({
    action: 'get_plans',
    data: {},
  });
}

async insertClient<T = any>(clientData: Partial<Client>): Promise<T> {
  const result = await this.invoke({
    action: 'insert_client',
    data: { clientData },
  });
  return result[0];
}
```

---

## Estrutura de Dados Atualizada

```typescript
interface AgentFormData {
  // Aba Cliente
  cod_agent: string;           // Gerado automaticamente
  client_id: number | null;    // ID do cliente selecionado
  is_closer: boolean;
  
  // Campos novo cliente (quando client_id === null)
  new_client: boolean;
  client_name: string;
  client_business_name: string;
  client_federal_id: string;
  client_email: string;
  client_phone: string;
  client_zip_code: string;
  client_street: string;
  client_street_number: string;
  client_complement: string;
  client_neighborhood: string;
  client_city: string;
  client_state: string;
  
  // Aba Planos
  plan_id: string;
  lead_limit: number;
  due_day: number;
  
  // Aba Configurações
  config_json: string;
  
  // Aba Prompt
  system_prompt: string;
  
  // Aba Usuário
  user_id: number | null;      // ID do usuário selecionado
  new_user: boolean;
  user_name: string;
  user_email: string;          // Pré-preenchido do cliente
}
```

---

## Componentes UI Reutilizados

- `Input` com máscaras existentes (`maskCPFCNPJ`, `maskPhone`, `maskCEP`)
- Busca de CEP via ViaCEP (mesma lógica do Profile)
- `ScrollArea` para lista de resultados de busca
- `Badge` para exibir cliente/usuário selecionado
- `Skeleton` para estados de carregamento

---

## Fluxo UX Otimizado

1. **Entrada Inicial:** Campo de busca vazio com placeholder orientativo
2. **Busca Automática:** Após 3 caracteres, lista aparece com debounce de 300ms
3. **Seleção Rápida:** Um clique seleciona e gera o código automaticamente
4. **Troca Fácil:** Botão "Trocar" permite voltar à busca
5. **Novo Cliente:** Formulário completo com CEP auto-preenchendo endereço
6. **Feedback Visual:** Loading states, contadores de resultados, mensagens de estado vazio

---

## Escopo

Esta implementação **NÃO** inclui a lógica de salvamento final (botão Salvar), que será tratada em uma próxima iteração após validação do layout e fluxos.
