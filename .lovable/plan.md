
# Plano: Padronizar Métricas do Dashboard com o CRM e Adicionar Card de Sessões

## Resumo

Ajustar o Dashboard para usar o mesmo critério de filtragem do CRM (`stage_entered_at` em vez de `created_at`) e adicionar um novo card de "Sessões" que exibe o total de sessões de atendimento da Julia, permitindo validar os valores da página de Desempenho.

---

## Mudanças Necessárias

### 1. Modificar `src/pages/dashboard/hooks/useDashboardData.ts`

#### 1.1 Alterar filtro de leads para usar `stage_entered_at`

**Queries a modificar:**

- `useDashboardStats`: Alterar de `created_at` para `stage_entered_at`
- `useDashboardStatsPrevious`: Alterar de `created_at` para `stage_entered_at`  
- `useRecentLeads`: Alterar de `created_at` para `stage_entered_at`
- `useDashboardEvolution`: Alterar de `created_at` para `stage_entered_at`
- `useDashboardFunnel`: Alterar de `created_at` para `stage_entered_at`

**Exemplo de mudança:**

```sql
-- ANTES
AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date

-- DEPOIS  
AND (stage_entered_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
AND (stage_entered_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
```

#### 1.2 Adicionar nova métrica de sessões

**Adicionar ao `DashboardStats`:**

```typescript
export interface DashboardStats {
  totalLeads: number;
  totalMessages: number;
  conversions: number;
  activeAgents: number;
  totalSessions: number;  // NOVO
}
```

**Adicionar query de sessões ao `useDashboardStats`:**

```sql
SELECT COUNT(DISTINCT session_id) as total
FROM vw_desempenho_julia
WHERE cod_agent::text = ANY($1::varchar[])
  AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
  AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
```

#### 1.3 Adicionar comparação de sessões ao período anterior

**Adicionar ao `DashboardStatsPrevious`:**

```typescript
export interface DashboardStatsPrevious {
  totalLeads: number;
  totalMessages: number;
  conversions: number;
  totalSessions: number;  // NOVO
}
```

---

### 2. Modificar `src/pages/Dashboard.tsx`

#### 2.1 Adicionar novo card de Sessões

Adicionar um novo card no array `statCards`:

```typescript
{
  title: 'Sessões Julia',
  value: stats?.totalSessions ?? 0,
  displayValue: (stats?.totalSessions ?? 0).toLocaleString('pt-BR'),
  icon: Activity, // Importar de lucide-react
  change: changes?.sessions,
  sparklineData: null,
  sparklineColor: '',
  description: 'Atendimentos de IA',
},
```

#### 2.2 Atualizar grid para 6 colunas

**Antes:**
```tsx
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
```

**Depois:**
```tsx
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
```

#### 2.3 Calcular variação de sessões

Adicionar no objeto `changes`:

```typescript
sessions: calculateChange(stats?.totalSessions ?? 0, statsPrevious.totalSessions),
```

---

## Detalhes Técnicos

### Queries Modificadas

| Query | Campo Atual | Campo Novo |
|-------|-------------|------------|
| Total de Leads | `created_at` | `stage_entered_at` |
| Conversões | `c.created_at` | `c.stage_entered_at` |
| Leads Recentes | `c.created_at` | `c.stage_entered_at` |
| Evolução | `c.created_at` | `c.stage_entered_at` |
| Funil | `c.created_at` | `c.stage_entered_at` |

### Nova Query de Sessões

```sql
SELECT COUNT(DISTINCT session_id) as total
FROM vw_desempenho_julia
WHERE cod_agent::text = ANY($1::varchar[])
  AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
  AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
```

---

## Layout Visual

### Antes (5 cards):
```text
[Total Leads] [Mensagens] [Conversões] [Taxa Conv.] [Agentes]
```

### Depois (6 cards):
```text
[Total Leads] [Mensagens] [Sessões Julia] [Conversões] [Taxa Conv.] [Agentes]
```

---

## Resultado Esperado

1. **Mesmas métricas do CRM**: O Total de Leads no Dashboard agora coincidirá com o CRM Leads quando os mesmos filtros forem aplicados

2. **Card de Sessões**: Permitirá ao usuário validar que o total de sessões no Dashboard corresponde ao total na página Desempenho Julia

3. **Comparação com período anterior**: O card de sessões também exibirá a variação percentual vs período anterior

---

## Resumo dos Arquivos

| Arquivo | Ação |
|---------|------|
| `src/pages/dashboard/hooks/useDashboardData.ts` | Alterar filtros para `stage_entered_at`, adicionar query de sessões |
| `src/pages/Dashboard.tsx` | Adicionar card de Sessões, ajustar grid para 6 colunas |
