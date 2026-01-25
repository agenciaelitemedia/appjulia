

# Plano: Restringir Menus por Role de Usuário

## Objetivo
Exibir os blocos **ADMINISTRATIVO** e **FINANCEIRO** no menu lateral (Sidebar) apenas para usuários com role `admin`.

---

## Análise Atual

O sistema já possui:
- Campo `role` no objeto do usuário autenticado (`User.role: string`)
- Hook `useAuth()` que expõe o usuário logado
- Menu definido estaticamente no `Sidebar.tsx`

---

## Implementação

### Arquivo: `src/components/layout/Sidebar.tsx`

1. **Importar o hook de autenticação**
   - Adicionar import do `useAuth` do contexto de autenticação

2. **Obter o usuário atual**
   - Chamar `useAuth()` dentro do componente para acessar `user`

3. **Adicionar propriedade de restrição aos grupos de menu**
   - Modificar a interface `MenuGroup` para incluir campo opcional `adminOnly?: boolean`
   - Marcar os grupos "ADMINISTRATIVO" e "FINANCEIRO" com `adminOnly: true`

4. **Filtrar grupos antes de renderizar**
   - Criar lógica que verifica se `user?.role === 'admin'`
   - Filtrar `menuGroups` para remover grupos `adminOnly` quando usuário não for admin

---

## Código Resumido

```typescript
// Adicionar na interface MenuGroup
interface MenuGroup {
  label: string;
  items: MenuItem[];
  adminOnly?: boolean;  // NOVO
}

// Marcar grupos restritos
{
  label: 'ADMINISTRATIVO',
  adminOnly: true,  // NOVO
  items: [...]
},
{
  label: 'FINANCEIRO', 
  adminOnly: true,  // NOVO
  items: [...]
}

// No componente Sidebar
const { user } = useAuth();
const isAdmin = user?.role === 'admin';

// Filtrar grupos
const filteredGroups = menuGroups.filter(group => 
  !group.adminOnly || isAdmin
);

// Renderizar filteredGroups ao invés de menuGroups
```

---

## Resultado Esperado

| Role do Usuário | Menus Visíveis |
|-----------------|----------------|
| `admin`         | Todos os menus (incluindo ADMINISTRATIVO e FINANCEIRO) |
| Outros roles    | Todos exceto ADMINISTRATIVO e FINANCEIRO |

---

## Segurança

Esta implementação controla apenas a **visibilidade do menu** (UI). Para segurança completa, as rotas `/admin/*` e `/financeiro/*` também devem ter proteção no backend ou via route guards no frontend.

