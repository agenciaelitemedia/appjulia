
# Plano: Menu baseado em Permissoes + Gerenciamento de Modulos

## Resumo Executivo

Transformar o sistema de menu do admin para ser dinamico, baseado nas permissoes dos modulos cadastrados, e adicionar uma interface CRUD para gerenciar modulos.

---

## Situacao Atual

### Menu (Sidebar.tsx)
- Menu e estatico com `menuGroups` hardcoded
- Filtragem atual:
  - `adminOnly` flag por grupo
  - `hideForTime` flag por item
  - Verifica apenas `user.role === 'admin'`

### Modulos (banco externo)
Tabela `modules` existente com campos:
- `id`, `code`, `name`, `description`, `category`, `is_active`, `display_order`

### Permissoes
- Ja existe verificacao via `usePermission()` hook
- Tabelas `user_permissions` e `role_default_permissions` funcionais

---

## Arquitetura Proposta

### 1. Novos Campos na Tabela modules

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `icon` | VARCHAR(50) | Nome do icone Lucide (ex: 'LayoutDashboard') |
| `route` | VARCHAR(100) | Caminho da rota (ex: '/dashboard') |
| `parent_module_id` | INT NULL | Para submenus (hierarquia) |
| `menu_group` | VARCHAR(50) | Grupo do menu (PRINCIPAL, CRM, etc.) |
| `is_menu_visible` | BOOLEAN | Se aparece no menu lateral |

### 2. Mapeamento Modulo -> Rota

Exemplo de dados:

```
code          | route                | icon              | menu_group         | display_order
--------------|----------------------|-------------------|--------------------|--------------
dashboard     | /dashboard           | LayoutDashboard   | PRINCIPAL          | 1
crm_leads     | /crm/leads           | Users             | CRM                | 10
admin_agents  | /admin/agentes       | Bot               | ADMINISTRATIVO     | 40
```

### 3. Fluxo do Menu Dinamico

```text
1. Usuario faz login
2. AuthContext carrega permissoes (ja implementado)
3. Sidebar busca modulos com is_menu_visible=true
4. Filtra modulos onde usuario tem can_view=true
5. Renderiza menu agrupado por menu_group
```

---

## Mudancas Necessarias

### Fase 1: Backend (Edge Function)

#### 1.1 Adicionar novos campos a tabela modules

Nova action `migrate_modules_schema`:
- Adicionar colunas `icon`, `route`, `parent_module_id`, `menu_group`, `is_menu_visible`
- Popular dados existentes com valores corretos

#### 1.2 Nova action `get_menu_modules`

Retorna modulos visiveis no menu para montar o Sidebar dinamicamente.

#### 1.3 CRUD de Modulos

Novas actions:
- `create_module`: Inserir novo modulo
- `update_module`: Atualizar modulo existente
- `delete_module`: Desativar modulo (soft delete via is_active=false)

### Fase 2: Frontend - Sidebar Dinamico

#### 2.1 Hook `useMenuModules`

```typescript
// src/hooks/useMenuModules.ts
export function useMenuModules() {
  const { permissions, isAdmin } = useAuth();
  
  return useQuery({
    queryKey: ['menu-modules'],
    queryFn: () => externalDb.getMenuModules(),
    select: (modules) => {
      // Filtrar por permissao
      return modules.filter(m => 
        isAdmin || permissions?.get(m.code)?.can_view
      );
    }
  });
}
```

#### 2.2 Refatorar Sidebar.tsx

- Remover `menuGroups` hardcoded
- Usar `useMenuModules()` para buscar modulos dinamicos
- Mapear icones dinamicamente via objeto lookup
- Agrupar por `menu_group`

### Fase 3: Gerenciamento de Modulos

#### 3.1 Nova Pagina `/admin/modulos`

Interface para:
- Listar modulos existentes (tabela com ordenacao)
- Criar novo modulo (dialog)
- Editar modulo (dialog)
- Reordenar modulos (drag & drop opcional)
- Ativar/desativar modulos

#### 3.2 Componentes

| Componente | Funcao |
|------------|--------|
| `ModulosPage.tsx` | Pagina principal |
| `ModulesList.tsx` | Tabela de modulos |
| `ModuleDialog.tsx` | Form criar/editar |
| `ModuleIconPicker.tsx` | Seletor de icones |

---

## Arquivos a Criar/Modificar

### Novos Arquivos

| Arquivo | Descricao |
|---------|-----------|
| `src/pages/admin/modulos/ModulosPage.tsx` | Pagina de gerenciamento |
| `src/pages/admin/modulos/components/ModulesList.tsx` | Lista de modulos |
| `src/pages/admin/modulos/components/ModuleDialog.tsx` | Dialog criar/editar |
| `src/pages/admin/modulos/hooks/useModulesAdmin.ts` | Hooks de CRUD |
| `src/hooks/useMenuModules.ts` | Hook para menu dinamico |
| `src/lib/iconMap.ts` | Mapeamento de icones |

### Arquivos a Modificar

| Arquivo | Modificacao |
|---------|-------------|
| `supabase/functions/db-query/index.ts` | Novas actions de modulos |
| `src/lib/externalDb.ts` | Metodos para novas actions |
| `src/components/layout/Sidebar.tsx` | Menu dinamico baseado em permissoes |
| `src/App.tsx` | Adicionar rota /admin/modulos |
| `src/types/permissions.ts` | Atualizar tipo Module |

---

## Detalhes Tecnicos

### Mapeamento de Icones

```typescript
// src/lib/iconMap.ts
import { 
  LayoutDashboard, Users, Bot, CreditCard, 
  FileText, Settings, MessageSquare, BarChart3,
  FileCheck, UserPlus, Package, Library, 
  UsersRound, Shield, Video, Layers
} from 'lucide-react';

export const iconMap: Record<string, React.ElementType> = {
  LayoutDashboard,
  Users,
  Bot,
  CreditCard,
  FileText,
  Settings,
  MessageSquare,
  BarChart3,
  FileCheck,
  UserPlus,
  Package,
  Library,
  UsersRound,
  Shield,
  Video,
  Layers,
};
```

### Novo Tipo Module Estendido

```typescript
export interface Module {
  id: number;
  code: ModuleCode;
  name: string;
  description?: string;
  category: ModuleCategory;
  is_active: boolean;
  display_order: number;
  // Novos campos
  icon?: string;
  route?: string;
  parent_module_id?: number | null;
  menu_group?: string;
  is_menu_visible?: boolean;
}
```

### Sidebar Dinamico (Logica Simplificada)

```typescript
// Dentro de Sidebar.tsx
const { data: menuModules = [], isLoading } = useMenuModules();

// Agrupar por menu_group
const groupedModules = menuModules.reduce((acc, mod) => {
  const group = mod.menu_group || 'OUTROS';
  if (!acc[group]) acc[group] = [];
  acc[group].push(mod);
  return acc;
}, {} as Record<string, Module[]>);

// Renderizar
{Object.entries(groupedModules).map(([groupName, modules]) => (
  <div key={groupName}>
    <h3>{groupName}</h3>
    {modules.map(mod => {
      const Icon = iconMap[mod.icon || 'Layers'];
      return (
        <NavLink to={mod.route}>
          <Icon />
          <span>{mod.name}</span>
        </NavLink>
      );
    })}
  </div>
))}
```

---

## Dados Iniciais para Migracao

Modulos com rotas e icones:

| code | name | route | icon | menu_group | display_order |
|------|------|-------|------|------------|---------------|
| dashboard | Dashboard | /dashboard | LayoutDashboard | PRINCIPAL | 1 |
| agent_management | Meus Agentes | /agente/meus-agentes | Bot | AGENTES DA JULIA | 20 |
| followup | FollowUP | /agente/followup | MessageSquare | AGENTES DA JULIA | 21 |
| strategic_perf | Desempenho Julia | /estrategico/desempenho | BarChart3 | AGENTES DA JULIA | 22 |
| strategic_contract | Contratos Julia | /estrategico/contratos | FileCheck | AGENTES DA JULIA | 23 |
| crm_leads | Leads | /crm/leads | Users | CRM | 10 |
| crm_monitoring | Monitoramento | /crm/lead-monitoramento | BarChart3 | CRM | 11 |
| crm_statistics | Estatisticas | /crm/lead-estatisticas | BarChart3 | CRM | 12 |
| video_room | Sala de Reuniao | /video/queue | Video | SISTEMA | 30 |
| library | Biblioteca | /biblioteca | Library | SISTEMA | 31 |
| team | Equipe | /equipe | UsersRound | SISTEMA | 32 |
| admin_agents | Lista de Agentes | /admin/agentes | Bot | ADMINISTRATIVO | 40 |
| admin_new_agent | Novo Agente | /admin/agentes-novo | UserPlus | ADMINISTRATIVO | 41 |
| admin_modules | Modulos | /admin/modulos | Layers | ADMINISTRATIVO | 42 |
| admin_permissions | Permissoes | /admin/permissoes | Shield | ADMINISTRATIVO | 43 |
| admin_products | Produtos | /admin/produtos | Package | ADMINISTRATIVO | 44 |
| admin_files | Arquivos Clientes | /admin/arquivos-clientes | FileText | ADMINISTRATIVO | 45 |
| finance_billing | Cobrancas | /financeiro/cobrancas | CreditCard | FINANCEIRO | 50 |
| finance_clients | Clientes | /financeiro/clientes | Users | FINANCEIRO | 51 |
| finance_reports | Relatorios | /financeiro/relatorios | BarChart3 | FINANCEIRO | 52 |
| settings | Configuracoes | /configuracoes | Settings | CONFIGURACOES | 60 |

---

## Ordem de Implementacao

1. **Backend**: Migrar schema + novas actions na edge function
2. **Types**: Atualizar tipos TypeScript
3. **ExternalDb**: Adicionar metodos
4. **Hook useMenuModules**: Buscar modulos para menu
5. **Icon Map**: Criar mapeamento de icones
6. **Sidebar**: Refatorar para usar modulos dinamicos
7. **Pagina Modulos**: Criar CRUD completo
8. **Rotas**: Adicionar /admin/modulos no App.tsx
9. **Testes**: Validar permissoes e menu dinamico

---

## Beneficios

1. **Flexibilidade**: Novos modulos podem ser adicionados sem codigo
2. **Permissoes Granulares**: Cada modulo e visivel apenas para quem tem acesso
3. **Manutencao Simplificada**: Menu gerenciado via interface
4. **Consistencia**: Uma unica fonte de verdade (tabela modules)
5. **Escalabilidade**: Facil adicionar novos recursos
