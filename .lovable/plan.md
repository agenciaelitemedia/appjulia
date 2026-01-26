
# Plano de Implementacao: Editar Agente (Layout em Abas)

## Resumo
Criar uma pagina de edicao de agentes usando o mesmo layout de abas do wizard de criacao, mantendo a consistencia visual e de navegacao. As abas serao as mesmas 5 do wizard, com conteudo adaptado para edicao.

---

## Estrutura das Abas

```text
+----------------------------------------------------------+
| [<- Voltar]                                    [Salvar]   |
+----------------------------------------------------------+
|                                                           |
| +-------------------------------------------------------+ |
| | [Cliente] [Planos] [Configuracoes] [Prompt] [Usuario] | |
| +-------------------------------------------------------+ |
|                                                           |
| CONTEUDO DA ABA ATIVA                                     |
|                                                           |
+----------------------------------------------------------+
| [Anterior]                           [Proximo] / [Salvar] |
+----------------------------------------------------------+
```

---

## Conteudo de Cada Aba (Modo Edicao)

### Aba 1: Cliente
- **Codigo do Agente**: Exibicao apenas (readonly)
- **Switch "E Closer"**: Editavel
- **Dados do Cliente**: Todos editaveis (nome, razao social, CPF/CNPJ, email, telefone, endereco completo com busca CEP)
- **Importante**: client_id nao pode ser alterado, apenas os dados do cliente vinculado

### Aba 2: Planos
- **Select Plano**: Editavel
- **Limite de Leads**: Editavel
- **Dia de Vencimento**: Editavel (1-31)
- **Uso Atual**: Exibicao apenas (X/Y leads)

### Aba 3: Configuracoes
- **Textarea JSON**: Editavel com validacao
- Mesma interface do wizard

### Aba 4: Prompt
- **Textarea Prompt**: Editavel
- Mesma interface do wizard

### Aba 5: Usuario
- **Dados de Acesso (Readonly)**:
  - Nome do usuario
  - Email do usuario
  - Senha: mostra remember_token ou mascara
  - Botao "Copiar" senha
  - Botao "Resetar Senha"
- Nenhum campo editavel, apenas visualizacao e reset

---

## Arquivos a Criar

### 1. `src/pages/agents/EditAgentPage.tsx`
Pagina principal usando mesmo layout do CreateAgentWizard:
- Carrega dados via `get_agent_details`
- FormProvider com react-hook-form
- Tabs com 5 abas (Cliente, Planos, Configuracoes, Prompt, Usuario)
- Navegacao Anterior/Proximo/Salvar
- Dialog de confirmacao para reset senha
- Dialog mostrando nova senha gerada

### 2. `src/pages/agents/components/edit-steps/EditClientStep.tsx`
Aba Cliente para edicao:
- Codigo readonly
- Switch Closer editavel
- Formulario de dados do cliente (reutiliza logica de mascaras e CEP)
- Sem opcao de trocar cliente ou criar novo

### 3. `src/pages/agents/components/edit-steps/EditPlanStep.tsx`
Aba Planos para edicao:
- Select de planos
- Input limite leads
- Input dia vencimento
- Exibicao uso atual (leads recebidos/limite)

### 4. `src/pages/agents/components/edit-steps/EditUserStep.tsx`
Aba Usuario para edicao:
- Card com dados de acesso (readonly)
- Email, Nome do usuario
- Senha com logica remember_token/mascara
- Botao Copiar senha
- Botao Resetar Senha com confirmacao

### 5. `src/pages/agents/hooks/useAgentUpdate.ts`
Hook para gerenciar atualizacao:
- Funcao `updateAgent(agentId, formData)`
- Funcao `resetPassword(userId)`
- Estados de loading

---

## Arquivos a Modificar

### 1. `supabase/functions/db-query/index.ts`
Adicionar endpoints:

#### `update_agent`
```sql
UPDATE agents 
SET settings = $1, prompt = $2, is_closer = $3, 
    agent_plan_id = $4, due_date = $5, status = $6, updated_at = now()
WHERE id = $7
RETURNING *
```

#### `reset_user_password`
```sql
UPDATE users 
SET password = $1, remember_token = $2, updated_at = now()
WHERE id = $3
RETURNING id, name, email
```

### 2. `src/lib/externalDb.ts`
Adicionar metodos:
- `updateAgent(agentId, data)` - Atualiza tabela agents
- `resetUserPassword(userId, hashedPassword, rawPassword)` - Reset senha

### 3. `src/App.tsx`
Adicionar rota:
```typescript
<Route path="/admin/agentes/:id/editar" element={<EditAgentPage />} />
```

### 4. `src/pages/agents/AgentsList.tsx`
Atualizar icone Pencil:
```typescript
<DropdownMenuItem onClick={() => navigate(`/admin/agentes/${agent.id}/editar`)}>
  <Pencil className="mr-2 h-4 w-4" />
  Editar
</DropdownMenuItem>
```

### 5. `src/pages/agents/AgentDetailsPage.tsx`
Adicionar botao Editar no header:
```typescript
<Button onClick={() => navigate(`/admin/agentes/${id}/editar`)}>
  <Pencil className="mr-2 h-4 w-4" />
  Editar
</Button>
```

---

## Interface de Dados

```typescript
interface AgentEditFormData {
  // Aba Cliente
  cod_agent: string; // readonly
  is_closer: boolean;
  status: boolean;
  
  // Dados do cliente (editaveis)
  client_id: number; // readonly, nao exibido
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
  
  // Aba Configuracoes
  config_json: string;
  
  // Aba Prompt
  system_prompt: string;
  
  // Aba Usuario (readonly, nao no form)
  user_id: number | null;
  user_name: string | null;
  user_email: string | null;
  remember_token: string | null;
  leads_received: number;
}
```

---

## Fluxo de Reset Senha

```typescript
1. Usuario clica "Resetar Senha"
2. Abre AlertDialog de confirmacao
3. Se confirmado:
   a. Gera nova senha: "Julia@" + 4 digitos
   b. Hash com bcrypt
   c. Chama resetUserPassword(userId, hash, raw)
   d. Atualiza estado local
   e. Abre Dialog mostrando nova senha
   f. Botao Copiar disponivel
```

---

## Fluxo de Salvamento

```typescript
1. Usuario clica "Salvar"
2. Valida JSON settings
3. Atualiza cliente via updateClient()
4. Atualiza agente via updateAgent()
5. Toast sucesso
6. Redireciona para detalhes
```

---

## Ordem de Implementacao

1. Endpoints Edge Function (update_agent, reset_user_password)
2. Metodos externalDb.ts
3. Hook useAgentUpdate.ts
4. Componentes edit-steps (EditClientStep, EditPlanStep, EditUserStep)
5. Pagina EditAgentPage.tsx
6. Rota no App.tsx
7. Navegacao AgentsList e AgentDetailsPage
8. Testes

---

## Abas Reutilizadas do Wizard

As abas de Configuracoes e Prompt podem reutilizar os mesmos componentes do wizard (ConfigStep e PromptStep) pois a logica e identica - apenas edicao de textarea.

---

## Cenarios de Teste

| Cenario | Esperado |
|---------|----------|
| Carregar pagina edicao | Dados preenchidos do agente |
| Editar dados cliente | Atualiza tabela clients |
| Alterar plano | Atualiza agent_plan_id |
| Editar JSON | Valida e salva settings |
| Editar prompt | Salva na tabela agents |
| Tentar editar usuario | Campos readonly |
| Resetar senha | Nova senha gerada e exibida |
| Navegar entre abas | Dados mantidos |
| Salvar alteracoes | Redireciona para detalhes |
