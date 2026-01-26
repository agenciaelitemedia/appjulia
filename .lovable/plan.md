
# Plano de Implementacao: Salvar Agente com Cadastros Auxiliares

## Resumo Executivo
Este plano detalha a implementacao do fluxo de salvamento do agente, incluindo validacoes previas, criacao de registros auxiliares (cliente e usuario) e tratamento de erros com rollback manual.

---

## Diagrama do Fluxo de Salvamento

```text
+------------------+     +------------------+     +------------------+
|  VALIDACOES      | --> |  CRIAR CLIENTE   | --> |  CRIAR USUARIO   |
|  (CPF, Email,    |     |  (se new_client) |     |  (se new_user)   |
|   cod_agent)     |     |  Retorna:        |     |  Gerar senha     |
|                  |     |  client_id       |     |  Julia@XXXX      |
+------------------+     +------------------+     +------------------+
         |                       |                       |
         v                       v                       v
+------------------------------------------------------------------+
|                    CRIAR AGENTE                                   |
|  Campos: client_id, cod_agent, settings, prompt, is_closer,      |
|          agent_plan_id, due_date                                  |
|  Retorna: agent_id                                                |
+------------------------------------------------------------------+
                                 |
                                 v
+------------------------------------------------------------------+
|                    CRIAR VINCULO USER_AGENTS                      |
|  Campos: user_id, agent_id                                        |
+------------------------------------------------------------------+
                                 |
                                 v
                    [SUCESSO] ou [ROLLBACK]
```

---

## Fase 1: Validacoes em Tempo Real (Frontend)

### 1.1 Validacao de CPF/CNPJ ao sair do campo (ClientStep)
- Adicionar evento `onBlur` no campo `client_federal_id`
- Chamar endpoint `check_federal_id_exists` para verificar duplicidade
- Exibir toast de erro se ja existir, bloquear avanço

### 1.2 Validacao de Email do Usuario ao sair do campo (UserStep)  
- Adicionar evento `onBlur` no campo `user_email` (quando new_user = true)
- Chamar endpoint `check_user_email_exists` para verificar duplicidade
- Exibir toast de erro se ja existir

---

## Fase 2: Novos Endpoints na Edge Function (db-query)

### 2.1 `check_federal_id_exists`
```sql
SELECT id FROM clients WHERE federal_id = $1 LIMIT 1
```
- Parametro: federal_id (somente numeros)
- Retorno: { exists: boolean, client_id?: number }

### 2.2 `check_user_email_exists`
```sql
SELECT id FROM users WHERE email = $1 LIMIT 1
```
- Parametro: email
- Retorno: { exists: boolean, user_id?: number }

### 2.3 `check_agent_code_exists`
```sql
SELECT id FROM agents WHERE cod_agent = $1 LIMIT 1
```
- Parametro: cod_agent
- Retorno: { exists: boolean }

### 2.4 `insert_user`
```sql
INSERT INTO users (name, email, password, remember_token, role, created_at)
VALUES ($1, $2, $3, $4, 'user', now())
RETURNING id, name, email
```
- Parametros: name, email, rawPassword
- Logica: 
  - Gerar senha padrao `Julia@` + 4 digitos aleatorios
  - Salvar senha em texto no `remember_token`
  - Salvar hash bcrypt no `password`

### 2.5 `insert_agent`
```sql
INSERT INTO agents (
  client_id, cod_agent, settings, prompt, is_closer, 
  agent_plan_id, due_date, status, is_visibilided, created_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, true, true, now())
RETURNING id
```
- Campos mapeados do formulario

### 2.6 `insert_user_agent`
```sql
INSERT INTO user_agents (user_id, agent_id, created_at)
VALUES ($1, $2, now())
RETURNING id
```

### 2.7 `delete_agent`
```sql
DELETE FROM agents WHERE id = $1
```

### 2.8 `check_user_has_agents`
```sql
SELECT COUNT(*) as count FROM user_agents WHERE user_id = $1
```

### 2.9 `check_client_has_agents`
```sql
SELECT COUNT(*) as count FROM agents WHERE client_id = $1
```

### 2.10 `delete_user`
```sql
DELETE FROM users WHERE id = $1
```

### 2.11 `delete_client`
```sql
DELETE FROM clients WHERE id = $1
```

---

## Fase 3: Metodos no Cliente ExternalDb

### 3.1 Novos metodos em `src/lib/externalDb.ts`
```typescript
// Validacoes
async checkFederalIdExists(federalId: string): Promise<{exists: boolean, clientId?: number}>
async checkUserEmailExists(email: string): Promise<{exists: boolean, userId?: number}>
async checkAgentCodeExists(codAgent: string): Promise<boolean>

// Insercoes
async insertUser(name: string, email: string): Promise<{id: number, name: string, email: string, tempPassword: string}>
async insertAgent(agentData: AgentInsertData): Promise<{id: number}>
async insertUserAgent(userId: number, agentId: number): Promise<void>

// Delecoes (para rollback)
async deleteAgent(agentId: number): Promise<void>
async checkUserHasAgents(userId: number): Promise<boolean>
async checkClientHasAgents(clientId: number): Promise<boolean>
async deleteUser(userId: number): Promise<void>
async deleteClient(clientId: number): Promise<void>
```

---

## Fase 4: Hook de Salvamento

### 4.1 Criar `src/pages/agents/hooks/useAgentSave.ts`
Hook que encapsula toda a logica de salvamento com:
- Estado de loading e erro
- Funcao `saveAgent(data: AgentFormData)`
- Logica de rollback em caso de erro

### 4.2 Fluxo do saveAgent:
```typescript
async function saveAgent(data: AgentFormData) {
  let createdClientId: number | null = null;
  let createdUserId: number | null = null;
  let createdAgentId: number | null = null;
  let isNewClient = false;
  let isNewUser = false;
  
  try {
    // 1. VALIDACOES FINAIS
    // 1.1 Se novo cliente, validar federal_id
    if (data.new_client) {
      const federalId = unmask(data.client_federal_id);
      const exists = await externalDb.checkFederalIdExists(federalId);
      if (exists.exists) {
        throw new Error('CPF/CNPJ ja cadastrado');
      }
    }
    
    // 1.2 Se novo usuario, validar email
    if (data.new_user) {
      const exists = await externalDb.checkUserEmailExists(data.user_email);
      if (exists.exists) {
        throw new Error('Email ja cadastrado');
      }
    }
    
    // 1.3 Validar cod_agent
    const codeExists = await externalDb.checkAgentCodeExists(data.cod_agent);
    if (codeExists) {
      // Gerar novo codigo e lancar erro
      await generateNewCode();
      throw new Error('Codigo do agente ja existe. Novo codigo gerado.');
    }
    
    // 2. CRIAR CLIENTE (se necessario)
    if (data.new_client) {
      isNewClient = true;
      const clientResult = await externalDb.insertClient({...});
      createdClientId = clientResult.id;
    } else {
      createdClientId = data.client_id;
    }
    
    // 3. CRIAR USUARIO (se necessario)
    if (data.new_user) {
      isNewUser = true;
      const userResult = await externalDb.insertUser(data.user_name, data.user_email);
      createdUserId = userResult.id;
      // Mostrar senha temporaria ao usuario
      toast.info(`Senha temporaria: ${userResult.tempPassword}`);
    } else {
      createdUserId = data.user_id;
    }
    
    // 4. CRIAR AGENTE
    const agentResult = await externalDb.insertAgent({
      client_id: createdClientId,
      cod_agent: data.cod_agent,
      settings: data.config_json,
      prompt: data.system_prompt,
      is_closer: data.is_closer,
      agent_plan_id: parseInt(data.plan_id),
      due_date: data.due_day,
    });
    createdAgentId = agentResult.id;
    
    // 5. CRIAR VINCULO USER_AGENTS
    await externalDb.insertUserAgent(createdUserId, createdAgentId);
    
    return { success: true, agentId: createdAgentId };
    
  } catch (error) {
    // ROLLBACK
    await rollback(createdAgentId, createdUserId, createdClientId, isNewUser, isNewClient);
    throw error;
  }
}

async function rollback(agentId, userId, clientId, isNewUser, isNewClient) {
  // 1. Deletar agente se foi criado
  if (agentId) {
    await externalDb.deleteAgent(agentId);
  }
  
  // 2. Deletar usuario se foi criado E nao tem outros agentes
  if (userId && isNewUser) {
    const hasAgents = await externalDb.checkUserHasAgents(userId);
    if (!hasAgents) {
      await externalDb.deleteUser(userId);
    }
  }
  
  // 3. Deletar cliente se foi criado E nao tem outros agentes
  if (clientId && isNewClient) {
    const hasAgents = await externalDb.checkClientHasAgents(clientId);
    if (!hasAgents) {
      await externalDb.deleteClient(clientId);
    }
  }
}
```

---

## Fase 5: Integracao no Wizard

### 5.1 Atualizar `CreateAgentWizard.tsx`
- Importar e usar `useAgentSave`
- Atualizar funcao `onSubmit` para chamar `saveAgent`
- Tratar erros e manter dados preenchidos
- Exibir toast de sucesso com senha temporaria (se novo usuario)

### 5.2 Atualizar `ClientStep.tsx`
- Adicionar `onBlur` no campo CPF/CNPJ para validar duplicidade
- Exibir feedback visual de validacao

### 5.3 Atualizar `UserStep.tsx`
- Adicionar `onBlur` no campo email para validar duplicidade (quando new_user)
- Exibir feedback visual de validacao

---

## Detalhes Tecnicos

### Geracao de Senha Padrao
```typescript
function generateDefaultPassword(): string {
  const digits = Math.floor(1000 + Math.random() * 9000); // 4 digitos
  return `Julia@${digits}`;
}
```

### Campos da tabela `agents` (estimados com base no uso)
| Campo | Tipo | Origem no Form |
|-------|------|----------------|
| client_id | integer | client_id ou novo client |
| cod_agent | bigint | cod_agent |
| settings | jsonb/text | config_json |
| prompt | text | system_prompt |
| is_closer | boolean | is_closer |
| agent_plan_id | integer | plan_id |
| due_date | integer | due_day |
| status | boolean | default true |
| is_visibilided | boolean | default true |

### Campos da tabela `users` (para novo usuario)
| Campo | Tipo | Valor |
|-------|------|-------|
| name | varchar | user_name |
| email | varchar | user_email |
| password | varchar | bcrypt hash |
| remember_token | varchar | senha em texto |
| role | varchar | 'user' |
| created_at | timestamp | now() |

### Campos da tabela `user_agents`
| Campo | Tipo | Valor |
|-------|------|-------|
| user_id | integer | FK users.id |
| agent_id | integer | FK agents.id |
| created_at | timestamp | now() |

---

## Arquivos a Criar/Modificar

### Novos Arquivos
1. `src/pages/agents/hooks/useAgentSave.ts` - Hook de salvamento

### Arquivos a Modificar
1. `supabase/functions/db-query/index.ts` - Novos endpoints
2. `src/lib/externalDb.ts` - Novos metodos cliente
3. `src/pages/agents/components/CreateAgentWizard.tsx` - Logica de submit
4. `src/pages/agents/components/wizard-steps/ClientStep.tsx` - Validacao onBlur CPF/CNPJ
5. `src/pages/agents/components/wizard-steps/UserStep.tsx` - Validacao onBlur email

---

## Ordem de Implementacao

1. Endpoints na Edge Function (todos os novos actions)
2. Metodos no externalDb.ts
3. Hook useAgentSave.ts
4. Validacoes em tempo real (ClientStep e UserStep)
5. Integracao no CreateAgentWizard.tsx
6. Testes end-to-end

---

## Tratamento de Erros

| Erro | Mensagem | Acao |
|------|----------|------|
| CPF/CNPJ duplicado | "CPF/CNPJ ja cadastrado" | Voltar para aba Cliente, destacar campo |
| Email duplicado | "Email ja cadastrado" | Voltar para aba Usuario, destacar campo |
| cod_agent duplicado | "Codigo do agente ja existe" | Gerar novo codigo automaticamente |
| Erro ao criar cliente | "Erro ao cadastrar cliente" | Nenhum dado foi salvo |
| Erro ao criar usuario | "Erro ao cadastrar usuario" | Rollback cliente se novo |
| Erro ao criar agente | "Erro ao criar agente" | Rollback usuario e cliente se novos |
| Erro ao vincular user_agent | "Erro ao vincular usuario" | Rollback completo |
