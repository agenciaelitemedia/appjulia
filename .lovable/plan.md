
# Plano: Menu "Equipe" e Gestao de Usuarios Time

## Resumo Executivo
Implementar uma nova funcionalidade de gerenciamento de equipe que permite a usuarios principais criarem membros de equipe (perfil "time") com acesso compartilhado aos seus agentes. Isso inclui renomear secoes do menu e criar uma nova pagina completa de gestao.

---

## Mudancas no Menu Lateral (Sidebar)

### Renomeacoes
| Atual | Novo |
|-------|------|
| MARKETING | SISTEMA |
| Criativos | Biblioteca |

### Nova Estrutura da Secao SISTEMA
```
SISTEMA
  |-- Biblioteca (antigo Criativos) → /biblioteca
  |-- Equipe (NOVO) → /equipe
```

**Arquivo**: `src/components/layout/Sidebar.tsx`

---

## Modelo de Dados

### Entendimento do Fluxo
1. Usuario principal (role: "user" ou "admin") cria um membro de equipe
2. Membro de equipe tem `role = 'time'` e `user_id = ID do usuario principal`
3. Ao criar, o sistema copia todos os `cod_agent` do usuario principal para a tabela `user_agents`
4. Membro da equipe herda acesso aos mesmos agentes do usuario principal

### Campos Relevantes na Tabela `users`
```
users
  id           (PK)
  name
  email
  password
  role         ('admin' | 'user' | 'time')  ← novo valor 'time'
  user_id      (FK → users.id) ← ID do usuario principal (null para users/admin)
  client_id    (FK → clients.id)
  cod_agent    (opcional)
  ...
```

### Relacao user_agents
```
user_agents
  id
  user_id      (FK → users.id)
  agent_id     (FK → agents.id)
  cod_agent    (bigint)
```

---

## Nova Pagina: Equipe

### Rota
`/equipe`

### Layout da Pagina

```
+----------------------------------------------------------+
|  Equipe                                        [+ Novo]  |
|  Gerencie os membros da sua equipe                       |
+----------------------------------------------------------+
|  [Buscar membro...]                                      |
+----------------------------------------------------------+
|                                                          |
|  +----------------+  +----------------+  +----------------+
|  | Avatar/Icone   |  | Avatar/Icone   |  | Avatar/Icone   |
|  | Nome Membro    |  | Nome Membro    |  | Nome Membro    |
|  | email@...      |  | email@...      |  | email@...      |
|  | 3 agentes      |  | 2 agentes      |  | 5 agentes      |
|  | [Editar][X]    |  | [Editar][X]    |  | [Editar][X]    |
|  +----------------+  +----------------+  +----------------+
|                                                          |
+----------------------------------------------------------+
```

### Componentes

1. **EquipeHeader** - Titulo + botao "Novo Membro"
2. **EquipeSearch** - Campo de busca por nome/email
3. **EquipeGrid** - Grid de cards dos membros
4. **EquipeMemberCard** - Card individual com info do membro
5. **EquipeMemberDialog** - Modal para criar/editar membro

---

## Modal de Criar/Editar Membro

### Campos do Formulario

| Campo | Tipo | Descricao |
|-------|------|-----------|
| Nome | Input | Nome do membro da equipe |
| Email | Input | Email de login (com validacao de unicidade) |
| Usuario Principal | Select/Combobox | Lista de usuarios disponiveis para vincular |
| Agentes | Checkboxes | Lista de agentes do usuario principal selecionado |

### Fluxo de Criacao

```
1. Usuario preenche Nome e Email
2. Sistema valida se email ja existe
3. Usuario seleciona "Usuario Principal" (dropdown)
4. Sistema carrega agentes vinculados ao usuario principal
5. Usuario marca quais agentes o membro tera acesso
6. Usuario clica "Salvar"
7. Sistema:
   a) Cria registro em `users` com role='time' e user_id=id_principal
   b) Para cada agente selecionado, cria registro em `user_agents`
   c) Retorna senha temporaria para o usuario
```

### Fluxo de Edicao

```
1. Usuario clica "Editar" no card do membro
2. Modal abre com dados pre-preenchidos
3. Usuario pode alterar:
   - Nome
   - Usuario Principal (muda vinculo)
   - Agentes selecionados
4. Sistema:
   a) Atualiza registro em `users`
   b) Sincroniza `user_agents` (remove os nao selecionados, adiciona novos)
```

---

## Backend: Novas Acoes na Edge Function

### 1. `get_team_members`
Retorna membros da equipe do usuario logado.

```sql
SELECT 
  u.id, u.name, u.email, u.user_id, u.created_at,
  COUNT(ua.id) as agents_count
FROM users u
LEFT JOIN user_agents ua ON ua.user_id = u.id
WHERE u.user_id = $1 AND u.role = 'time'
GROUP BY u.id
ORDER BY u.name
```

### 2. `get_principal_users`
Retorna usuarios principais disponiveis para vincular (somente para admin, ou o proprio usuario logado para users comuns).

```sql
-- Para admin: todos os usuarios com role != 'time'
-- Para user comum: somente ele mesmo
SELECT id, name, email, role
FROM users
WHERE role IN ('admin', 'user')
ORDER BY name
```

### 3. `get_user_agents_for_principal`
Retorna agentes de um usuario principal especifico.

```sql
SELECT ua.agent_id, ua.cod_agent::text, a.status, c.business_name
FROM user_agents ua
JOIN agents a ON a.id = ua.agent_id
JOIN clients c ON c.id = a.client_id
WHERE ua.user_id = $1
ORDER BY c.business_name
```

### 4. `insert_team_member`
Cria novo membro da equipe.

```typescript
{
  name: string;
  email: string;
  hashedPassword: string;
  rawPassword: string;
  principalUserId: number;
  clientId: number;
  agentIds: { agentId: number; codAgent: string }[];
}
```

### 5. `update_team_member`
Atualiza membro existente.

### 6. `delete_team_member`
Remove membro e seus vinculos em `user_agents`.

### 7. `sync_team_member_agents`
Sincroniza agentes de um membro (remove antigos, adiciona novos).

---

## Arquivos a Criar

```
src/pages/equipe/
  |-- EquipePage.tsx           # Pagina principal
  |-- types.ts                 # Tipos TypeScript
  |-- components/
  |     |-- EquipeHeader.tsx
  |     |-- EquipeSearch.tsx
  |     |-- EquipeGrid.tsx
  |     |-- EquipeMemberCard.tsx
  |     |-- EquipeMemberDialog.tsx
  |     |-- AgentCheckboxList.tsx
  |-- hooks/
        |-- useEquipeData.ts   # Queries e mutations
```

---

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/components/layout/Sidebar.tsx` | Renomear secoes, adicionar menu Equipe |
| `src/App.tsx` | Adicionar rota `/equipe` e renomear `/criativos` para `/biblioteca` |
| `supabase/functions/db-query/index.ts` | Adicionar 7 novas acoes |
| `src/lib/externalDb.ts` | Adicionar metodos helper para as novas acoes |

---

## Experiencia do Usuario (UX)

### Destaques
1. **Cards Visuais**: Interface em grid com cards que mostram rapidamente o status de cada membro
2. **Selecao Intuitiva de Agentes**: Checkboxes com nome do agente e cliente para facil identificacao
3. **Feedback Imediato**: Validacao de email em tempo real, igual ao fluxo de criacao de agente
4. **Senha Temporaria**: Exibicao clara da senha gerada com botao de copiar
5. **Confirmacao de Exclusao**: Dialog de confirmacao antes de remover membro

### Fluxo Simplificado para Usuario Comum
- Usuario comum ve apenas seus proprios agentes disponiveis
- Nao precisa selecionar "Usuario Principal" (e automaticamente ele mesmo)
- Interface mais limpa e direta

### Fluxo para Admin
- Admin pode vincular membros a qualquer usuario principal
- Dropdown com busca para encontrar o usuario
- Ve todos os agentes do usuario selecionado

---

## Ordem de Implementacao

1. Modificar Sidebar (renomeacoes + novo menu)
2. Atualizar rotas no App.tsx
3. Criar estrutura de pastas e tipos
4. Implementar acoes no backend (db-query)
5. Criar hooks de dados (useEquipeData)
6. Criar componentes da pagina
7. Integrar tudo e testar

---

## Detalhes Tecnicos

### Validacoes

1. **Email**: Verificar unicidade antes de criar/editar
2. **Agentes**: Pelo menos 1 agente deve ser selecionado
3. **Usuario Principal**: Obrigatorio para role='time'

### Geracao de Senha

Usar mesma logica do wizard de agentes:
```typescript
function generateDefaultPassword(): string {
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `Julia@${digits}`;
}
```

### Seguranca

- Usuarios com role='time' so veem a pagina "Meus Agentes"
- Nao tem acesso ao menu "Equipe" (somente user/admin)
- Verificacao de permissao no backend antes de listar membros
