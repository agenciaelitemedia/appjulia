
# Plano: Corrigir Menu Ativo Duplicado e Botão Atualizar do CRM

## Problema 1: Menu Ativo Duplicado

### Diagnóstico
Na função `isMenuActive` do Sidebar.tsx (linha 123-133), a lógica atual é:
```typescript
if (item.href) {
  return location.pathname === item.href || location.pathname.startsWith(item.href + '/');
}
```

Quando o usuário está em `/leads/monitoramento`:
- "Leads" (`/leads`) → `startsWith('/leads/')` = true (INCORRETO)
- "Monitoramento" (`/leads/monitoramento`) → match exato = true (CORRETO)

### Solução
Modificar a lógica para verificar se a rota é exata OU se é uma sub-rota que NÃO está definida como item separado no menu:

```typescript
const isMenuActive = (item: MenuItem): boolean => {
  if (item.href) {
    // Match exato
    if (location.pathname === item.href) return true;
    
    // Para sub-rotas, verificar se não existe outro item de menu mais específico
    // Só ativa se a rota atual começa com href E não há outro item que seja match mais específico
    const allMenuHrefs = menuGroups.flatMap(g => 
      g.items.flatMap(i => i.href ? [i.href] : i.children?.map(c => c.href) || [])
    );
    
    const hasMoreSpecificMatch = allMenuHrefs.some(href => 
      href !== item.href && 
      location.pathname.startsWith(href) && 
      href.startsWith(item.href!)
    );
    
    return !hasMoreSpecificMatch && location.pathname.startsWith(item.href + '/');
  }
  // ... resto da lógica para children
}
```

**Alternativa mais simples:** Usar apenas match exato para itens sem children:
```typescript
const isMenuActive = (item: MenuItem): boolean => {
  if (item.href) {
    return location.pathname === item.href;
  }
  // ... children logic
}
```

---

## Problema 2: Botão Atualizar no CRM

### Diagnóstico
O CRMPage.tsx já tem o botão funcionando corretamente com `refetch()`. O problema pode ser:
1. O usuário quer que funcione também nas páginas de Monitoramento/Estatísticas
2. O refetch pode não estar invalidando o cache corretamente

### Solução
Garantir que o `refetch()` seja chamado corretamente e adicionar o mesmo padrão nas outras páginas CRM:

**Para CRMMonitoringPage.tsx:**
- Adicionar header com botão "Atualizar" similar ao CRMPage
- Criar função que chama refetch de todos os hooks

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/layout/Sidebar.tsx` | Corrigir função `isMenuActive` para match exato |
| `src/pages/crm/monitoring/CRMMonitoringPage.tsx` | Adicionar header com botão Atualizar |
| `src/pages/crm/statistics/CRMStatisticsPage.tsx` | Adicionar header com botão Atualizar |

---

## Implementação Detalhada

### 1. Sidebar.tsx - Corrigir isMenuActive

```typescript
const isMenuActive = (item: MenuItem): boolean => {
  if (item.href) {
    // Apenas match exato para evitar múltiplos itens ativos
    return location.pathname === item.href;
  }
  if (item.children) {
    return item.children.some(child => 
      location.pathname === child.href
    );
  }
  return false;
};
```

### 2. CRMMonitoringPage.tsx - Adicionar Refresh

```typescript
// Importar CRMHeader ou criar header inline com botão
const handleRefresh = () => {
  // Refetch all queries
  refetchStuck();
  refetchActivity();
  refetchWorkload();
  refetchBottlenecks();
};

// No JSX, adicionar botão de refresh no header
<div className="flex justify-between items-center">
  <div>
    <h1>Monitoramento do CRM</h1>
    <p>...</p>
  </div>
  <Button onClick={handleRefresh} disabled={isAnyLoading}>
    <RefreshCw className={isAnyLoading ? 'animate-spin' : ''} />
    Atualizar
  </Button>
</div>
```

### 3. CRMStatisticsPage.tsx - Adicionar Refresh (mesmo padrão)

---

## Resultado Esperado

1. **Menu:** Apenas o item exato ficará ativo (Monitoramento ativo, Leads não ativo quando em /leads/monitoramento)
2. **Botão Atualizar:** Funcionará em todas as páginas do CRM, recarregando os dados de acordo com os filtros atuais
