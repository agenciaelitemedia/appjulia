
# Correção dos Campos Numéricos `last_used` e `due_date`

## Problema Identificado

Os campos `last_used` e `due_date` são **numéricos** no banco de dados, não campos de data. Quando não há valor definido, retornam `0` ou `"0"`, o que causa comportamento incorreto:

- `new Date("0")` ou `new Date(0)` gera uma data inválida ou 01/01/1970
- As funções atuais não validam esses casos

---

## Solução

### 1. Atualizar Interface TypeScript

Alterar os tipos de `string | null` para `number | string | null` para refletir que podem vir valores numéricos:

```typescript
interface AgentListItem {
  // ... outros campos
  last_used: number | string | null;
  due_date: number | string | null;
}
```

### 2. Corrigir `formatLastUsed`

Adicionar validação para valores `0`, `"0"`, `null` e `undefined`:

```typescript
const formatLastUsed = (value: number | string | null): string => {
  // Retorna '-' para valores inválidos: null, undefined, 0, "0", string vazia
  if (!value || value === 0 || value === '0') return '-';
  
  const lastDate = new Date(value);
  
  // Verifica se a data é válida
  if (isNaN(lastDate.getTime())) return '-';
  
  const now = new Date();
  const diffMs = now.getTime() - lastDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return `${diffDays}d atrás`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}sem atrás`;
  return `${Math.floor(diffDays / 30)}m atrás`;
};
```

### 3. Corrigir `formatDueDate`

Aplicar a mesma validação:

```typescript
const formatDueDate = (value: number | string | null): { text: string; diffDays: number } | null => {
  // Retorna null para valores inválidos: null, undefined, 0, "0", string vazia
  if (!value || value === 0 || value === '0') return null;
  
  const dueDate = new Date(value);
  
  // Verifica se a data é válida
  if (isNaN(dueDate.getTime())) return null;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return { text: `Dia ${dueDate.getDate()}`, diffDays };
};
```

### 4. Ajustar Ordenação

Atualizar a lógica de ordenação para tratar valores `0` ou `"0"` como ausência de data:

```typescript
case 'last_used':
  aVal = (a.last_used && a.last_used !== 0 && a.last_used !== '0') 
    ? new Date(a.last_used).getTime() 
    : 0;
  bVal = (b.last_used && b.last_used !== 0 && b.last_used !== '0') 
    ? new Date(b.last_used).getTime() 
    : 0;
  break;
case 'due_date':
  aVal = (a.due_date && a.due_date !== 0 && a.due_date !== '0') 
    ? new Date(a.due_date).getTime() 
    : 0;
  bVal = (b.due_date && b.due_date !== 0 && b.due_date !== '0') 
    ? new Date(b.due_date).getTime() 
    : 0;
  break;
```

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/agents/AgentsList.tsx` | Atualizar tipos na interface `AgentListItem` |
| `src/pages/agents/AgentsList.tsx` | Corrigir função `formatLastUsed` |
| `src/pages/agents/AgentsList.tsx` | Corrigir função `formatDueDate` |
| `src/pages/agents/AgentsList.tsx` | Ajustar lógica de ordenação para `last_used` e `due_date` |

---

## Resultado Esperado

| Valor do banco | Exibição |
|----------------|----------|
| `null` | `-` |
| `0` | `-` |
| `"0"` | `-` |
| `""` | `-` |
| `"2024-01-15"` | Formatado corretamente |
| `1705276800000` (timestamp) | Formatado corretamente |
