

# Análise Completa do Sistema de Permissões e Plano de Implementação

## 1. Análise do Sistema Atual

### 1.1 Estrutura Existente no Banco de Dados Externo

**Tabela `users`** (estrutura atual):
```text
+-------------------+-------------------+-----------+
| Coluna            | Tipo              | Nullable  |
+-------------------+-------------------+-----------+
| id                | bigint            | NO        |
| name              | varchar           | NO        |
| email             | varchar           | NO        |
| password          | varchar           | NO        |
| role              | varchar           | YES       |
| user_id           | bigint            | YES       |
| client_id         | bigint            | YES       |
| cod_agent         | bigint            | YES       |
| status            | boolean           | YES       |
+-------------------+-------------------+-----------+
```

**Roles existentes**: `admin`, `user`, `time`

**Tabela `user_agents`** (relacionamento usuário-agente):
```text
+-------------------+-------------------+-----------+
| Coluna            | Tipo              | Nullable  |
+-------------------+-------------------+-----------+
| id                | bigint            | NO        |
| user_id           | bigint            | YES       |
| agent_id          | bigint            | YES       |
| cod_agent         | bigint            | YES       |
| status            | boolean           | YES       |
+-------------------+-------------------+-----------+
```

### 1.2 Sistema de Permissões Atual no Frontend

O sistema atual implementa controle básico via:
- Campo `role` na tabela `users` (string simples)
- Verificação hardcoded no frontend (`user.role === 'admin'`)
- Propriedade `adminOnly` nos grupos de menu
- Propriedade `hideForTime` para esconder itens de usuários `time`

**Pontos de verificação de permissão:**
- `AdminRoute.tsx`: Redireciona se não for admin
- `Sidebar.tsx`: Filtra menus por role
- Hooks de dados: Filtram por `user_id` conforme role

---

## 2. Proposta de Novo Sistema de Permissões

### 2.1 Hierarquia de Perfis Proposta

```text
┌─────────────────────────────────────────────────────────────────┐
│  ADMIN                                                          │
│  - Acesso total ao sistema                                      │
│  - Independente de permissões de módulo                         │
│  - Pode gerenciar todos os agentes e clientes                   │
├─────────────────────────────────────────────────────────────────┤
│  COLABORADOR (novo perfil)                                      │
│  - Funcionário interno da Julia                                 │
│  - Permissões definidas por módulo                              │
│  - Pode ter acesso a múltiplos agentes/clientes                 │
├─────────────────────────────────────────────────────────────────┤
│  USER (cliente)                                                 │
│  - Dono de um ou mais agentes                                   │
│  - Permissões dos módulos definidas pelo admin                  │
│  - Pode criar membros de equipe (time)                          │
├─────────────────────────────────────────────────────────────────┤
│  TIME (equipe do usuário)                                       │
│  - Subordinado a um USER (pai)                                  │
│  - Herda permissões do USER pai com restrições                  │
│  - Acesso apenas aos agentes liberados pelo USER pai            │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Módulos do Sistema

```text
┌────────────────────┬─────────────────────────────────┐
│ Identificador      │ Descrição                       │
├────────────────────┼─────────────────────────────────┤
│ dashboard          │ Dashboard principal             │
│ crm_leads          │ CRM - Visualização de leads     │
│ crm_monitoring     │ CRM - Monitoramento             │
│ crm_statistics     │ CRM - Estatísticas              │
│ agent_management   │ Meus Agentes                    │
│ followup           │ FollowUp                        │
│ strategic_perf     │ Desempenho Julia                │
│ strategic_contract │ Contratos Julia                 │
│ library            │ Biblioteca (Criativos)          │
│ team               │ Gestão de Equipe                │
│ admin_agents       │ Admin - Lista de Agentes        │
│ admin_products     │ Admin - Produtos                │
│ admin_files        │ Admin - Arquivos Clientes       │
│ finance_billing    │ Financeiro - Cobranças          │
│ finance_clients    │ Financeiro - Clientes           │
│ finance_reports    │ Financeiro - Relatórios         │
│ settings           │ Configurações do Sistema        │
└────────────────────┴─────────────────────────────────┘
```

---

## 3. Estrutura de Tabelas Proposta (Banco Externo)

### 3.1 Tabela `user_roles` (Enum de Roles)

```sql
CREATE TYPE public.app_role AS ENUM ('admin', 'colaborador', 'user', 'time');
```

### 3.2 Tabela `modules` (Catálogo de Módulos)

```sql
CREATE TABLE public.modules (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50), -- 'principal', 'crm', 'agente', 'sistema', 'admin', 'financeiro'
    is_active BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Dados iniciais
INSERT INTO modules (code, name, category, display_order) VALUES
('dashboard', 'Dashboard', 'principal', 1),
('crm_leads', 'Leads', 'crm', 10),
('crm_monitoring', 'Monitoramento', 'crm', 11),
('crm_statistics', 'Estatísticas', 'crm', 12),
('agent_management', 'Meus Agentes', 'agente', 20),
('followup', 'FollowUp', 'agente', 21),
('strategic_perf', 'Desempenho Julia', 'agente', 22),
('strategic_contract', 'Contratos Julia', 'agente', 23),
('library', 'Biblioteca', 'sistema', 30),
('team', 'Equipe', 'sistema', 31),
('admin_agents', 'Lista de Agentes', 'admin', 40),
('admin_products', 'Produtos', 'admin', 41),
('admin_files', 'Arquivos Clientes', 'admin', 42),
('finance_billing', 'Cobranças', 'financeiro', 50),
('finance_clients', 'Clientes', 'financeiro', 51),
('finance_reports', 'Relatórios', 'financeiro', 52),
('settings', 'Configurações', 'admin', 60);
```

### 3.3 Tabela `user_permissions` (Permissões por Usuário)

```sql
CREATE TABLE public.user_permissions (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_id INT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    can_view BOOLEAN DEFAULT FALSE,
    can_create BOOLEAN DEFAULT FALSE,
    can_edit BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, module_id)
);

-- Índices para performance
CREATE INDEX idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX idx_user_permissions_module_id ON user_permissions(module_id);
```

### 3.4 Tabela `role_default_permissions` (Permissões Padrão por Role)

```sql
CREATE TABLE public.role_default_permissions (
    id SERIAL PRIMARY KEY,
    role VARCHAR(20) NOT NULL,
    module_id INT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    can_view BOOLEAN DEFAULT FALSE,
    can_create BOOLEAN DEFAULT FALSE,
    can_edit BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    UNIQUE(role, module_id)
);

-- Permissões padrão para cada role
-- ADMIN: tudo
INSERT INTO role_default_permissions (role, module_id, can_view, can_create, can_edit, can_delete)
SELECT 'admin', id, TRUE, TRUE, TRUE, TRUE FROM modules;

-- COLABORADOR: módulos operacionais (não admin/financeiro por padrão)
INSERT INTO role_default_permissions (role, module_id, can_view, can_create, can_edit, can_delete)
SELECT 'colaborador', id, TRUE, TRUE, TRUE, FALSE 
FROM modules WHERE category NOT IN ('admin', 'financeiro');

-- USER: módulos de cliente
INSERT INTO role_default_permissions (role, module_id, can_view, can_create, can_edit, can_delete)
SELECT 'user', id, TRUE, TRUE, TRUE, TRUE 
FROM modules WHERE category IN ('principal', 'crm', 'agente', 'sistema');

-- TIME: módulos restritos (sem team)
INSERT INTO role_default_permissions (role, module_id, can_view, can_create, can_edit, can_delete)
SELECT 'time', id, TRUE, FALSE, FALSE, FALSE 
FROM modules WHERE code NOT IN ('team', 'settings') AND category IN ('principal', 'crm', 'agente');
```

### 3.5 Alteração na Tabela `users`

```sql
-- Adicionar novo valor ao campo role (se necessário converter para ENUM)
-- Por enquanto, manter como VARCHAR e adicionar 'colaborador'

-- Adicionar coluna para permissões customizadas
ALTER TABLE users 
ADD COLUMN use_custom_permissions BOOLEAN DEFAULT FALSE;

-- Adicionar coluna para status mais granular
ALTER TABLE users 
ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
```

---

## 4. Lógica de Verificação de Permissão

### 4.1 Regras de Negócio

```text
┌──────────────────────────────────────────────────────────────────┐
│ FLUXO DE VERIFICAÇÃO DE PERMISSÃO                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Usuário está ativo? (is_active = true)                       │
│     ├── NÃO → Acesso negado                                      │
│     └── SIM → Continua                                           │
│                                                                  │
│  2. Role é 'admin'?                                              │
│     ├── SIM → Acesso total (bypass de permissões)                │
│     └── NÃO → Continua                                           │
│                                                                  │
│  3. Usa permissões customizadas? (use_custom_permissions)        │
│     ├── SIM → Buscar em user_permissions                         │
│     └── NÃO → Buscar em role_default_permissions                 │
│                                                                  │
│  4. Role é 'time'?                                               │
│     ├── SIM → Verificar também permissões do user_id pai         │
│     │         (só pode ter permissão se pai também tem)          │
│     └── NÃO → Usar permissão encontrada                          │
│                                                                  │
│  5. Verificar acesso a agentes (para dados)                      │
│     └── Filtrar por user_agents conforme role                    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 Função SQL para Verificação

```sql
CREATE OR REPLACE FUNCTION check_user_permission(
    p_user_id BIGINT,
    p_module_code VARCHAR,
    p_permission_type VARCHAR DEFAULT 'view' -- view, create, edit, delete
) RETURNS BOOLEAN AS $$
DECLARE
    v_user RECORD;
    v_permission BOOLEAN;
    v_parent_permission BOOLEAN;
    v_module_id INT;
BEGIN
    -- Buscar dados do usuário
    SELECT id, role, user_id, use_custom_permissions, is_active 
    INTO v_user FROM users WHERE id = p_user_id;
    
    -- Usuário não encontrado ou inativo
    IF NOT FOUND OR NOT COALESCE(v_user.is_active, TRUE) THEN
        RETURN FALSE;
    END IF;
    
    -- Admin tem acesso total
    IF v_user.role = 'admin' THEN
        RETURN TRUE;
    END IF;
    
    -- Buscar ID do módulo
    SELECT id INTO v_module_id FROM modules WHERE code = p_module_code AND is_active;
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Verificar permissão
    IF COALESCE(v_user.use_custom_permissions, FALSE) THEN
        -- Permissões customizadas
        SELECT 
            CASE p_permission_type
                WHEN 'view' THEN can_view
                WHEN 'create' THEN can_create
                WHEN 'edit' THEN can_edit
                WHEN 'delete' THEN can_delete
                ELSE FALSE
            END INTO v_permission
        FROM user_permissions 
        WHERE user_id = p_user_id AND module_id = v_module_id;
    ELSE
        -- Permissões padrão do role
        SELECT 
            CASE p_permission_type
                WHEN 'view' THEN can_view
                WHEN 'create' THEN can_create
                WHEN 'edit' THEN can_edit
                WHEN 'delete' THEN can_delete
                ELSE FALSE
            END INTO v_permission
        FROM role_default_permissions 
        WHERE role = v_user.role AND module_id = v_module_id;
    END IF;
    
    v_permission := COALESCE(v_permission, FALSE);
    
    -- Se for TIME, verificar também permissão do usuário pai
    IF v_user.role = 'time' AND v_user.user_id IS NOT NULL THEN
        v_parent_permission := check_user_permission(v_user.user_id, p_module_code, p_permission_type);
        RETURN v_permission AND v_parent_permission;
    END IF;
    
    RETURN v_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 5. Análise de Impacto

### 5.1 Impacto no Backend (Edge Function)

| Área                | Impacto | Descrição                                          |
|---------------------|---------|---------------------------------------------------|
| Login               | MÉDIO   | Retornar permissões junto com dados do usuário    |
| Endpoints de dados  | BAIXO   | Manter lógica atual de filtragem por user_agents  |
| Novos endpoints     | ALTO    | Criar CRUD para módulos e permissões              |
| Verificação         | MÉDIO   | Adicionar chamada à função check_user_permission  |

### 5.2 Impacto no Frontend

| Componente          | Impacto | Descrição                                          |
|---------------------|---------|---------------------------------------------------|
| AuthContext         | MÉDIO   | Armazenar permissões do usuário no contexto       |
| Sidebar             | MÉDIO   | Renderizar menus baseado em permissões            |
| Route Guards        | MÉDIO   | Verificar permissão específica, não apenas role   |
| Hooks de dados      | BAIXO   | Manter lógica atual (controle já é por agentes)   |
| Página Admin        | ALTO    | Criar interface para gerenciar permissões         |

### 5.3 Riscos e Mitigações

| Risco                                    | Probabilidade | Impacto | Mitigação                                   |
|------------------------------------------|---------------|---------|---------------------------------------------|
| Usuários existentes perderem acesso      | BAIXA         | ALTA    | Criar permissões padrão para todos          |
| Performance degradada                    | BAIXA         | MÉDIA   | Índices + cache de permissões no login      |
| Inconsistência role vs permissions       | MÉDIA         | MÉDIA   | Sincronizar role com permissões padrão      |
| Falha na migração                        | BAIXA         | ALTA    | Testar em ambiente de staging primeiro      |
| Membro TIME herdando permissão indevida  | BAIXA         | ALTA    | Verificação dupla (pai + filho)             |

---

## 6. Plano de Implementação

### Fase 1: Estrutura do Banco de Dados (Backend)

1. **Criar tabelas no banco externo:**
   - `modules` - catálogo de módulos
   - `user_permissions` - permissões customizadas
   - `role_default_permissions` - permissões padrão

2. **Criar função SQL:**
   - `check_user_permission()` - verificação centralizada

3. **Alterar tabela `users`:**
   - Adicionar `use_custom_permissions`
   - Adicionar `is_active`

4. **Popular dados iniciais:**
   - Inserir todos os módulos
   - Inserir permissões padrão por role

### Fase 2: Edge Function (Backend)

1. **Novo endpoint `get_user_permissions`:**
   - Retorna todas as permissões do usuário
   - Chamado no login

2. **Atualizar endpoint `login`:**
   - Incluir array de permissões na resposta
   - Incluir flag `is_active`

3. **Novos endpoints de administração:**
   - `get_modules` - listar módulos
   - `get_all_user_permissions` - admin visualizar permissões
   - `update_user_permissions` - admin editar permissões
   - `sync_role_permissions` - sincronizar com padrão do role

### Fase 3: Frontend - Contexto e Tipos

1. **Atualizar AuthContext:**
   - Adicionar interface `UserPermission`
   - Armazenar permissões no estado
   - Criar helper `hasPermission(module, action)`

2. **Criar hook `usePermission`:**
   - `canView(module)`, `canEdit(module)`, etc.
   - Verificação simplificada para componentes

3. **Criar guarda de rota genérico:**
   - `ProtectedRoute` com prop `module`
   - Substitui `AdminRoute` (mantido para compatibilidade)

### Fase 4: Frontend - Interface de Administração

1. **Página de Gerenciamento de Permissões:**
   - Lista de usuários com filtro por role
   - Matriz de permissões (módulo x ação)
   - Toggle para usar permissões customizadas
   - Botão para resetar para padrão do role

2. **Atualizar Sidebar:**
   - Usar `canView` ao invés de `role === 'admin'`
   - Manter compatibilidade com lógica atual

### Fase 5: Migração e Testes

1. **Script de migração:**
   - Criar permissões para usuários existentes
   - Baseado no role atual de cada um

2. **Testes:**
   - Testar cada perfil (admin, colaborador, user, time)
   - Testar herança de permissões TIME
   - Testar permissões customizadas

---

## 7. Estimativa de Esforço

| Fase                              | Complexidade | Tarefas |
|-----------------------------------|--------------|---------|
| Fase 1: Banco de Dados            | Média        | 4       |
| Fase 2: Edge Function             | Média        | 5       |
| Fase 3: Frontend - Contexto       | Média        | 4       |
| Fase 4: Frontend - Admin UI       | Alta         | 3       |
| Fase 5: Migração e Testes         | Média        | 3       |
| **Total**                         |              | **19**  |

---

## 8. Probabilidade de Problemas

| Categoria           | Probabilidade | Motivo                                              |
|---------------------|---------------|-----------------------------------------------------|
| Bugs na migração    | 15%           | Dados existentes são simples                        |
| Conflitos de lógica | 20%           | Sistema atual é básico, fácil de adaptar            |
| Perda de acesso     | 5%            | Permissões padrão garantem continuidade             |
| Performance         | 10%           | Cache + índices mitigam                             |
| Regressão frontend  | 15%           | Manter compatibilidade com lógica atual             |

**Risco Geral: BAIXO a MÉDIO** - O sistema atual é simples e a migração incremental reduz riscos.

---

## 9. Recomendações

1. **Implementar em fases** - não fazer tudo de uma vez
2. **Manter compatibilidade** - `AdminRoute` continua funcionando
3. **Cache de permissões** - armazenar no login, evitar chamadas repetidas
4. **Logs de auditoria** - registrar alterações de permissão
5. **Tela de preview** - antes de salvar permissões, mostrar o que o usuário poderá acessar

