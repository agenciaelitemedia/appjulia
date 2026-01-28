
# Plano: Ajustar Taxa de Conversão para Base em Sessões Julia

## Resumo
Alterar o cálculo da taxa de conversão no Dashboard principal para usar o número de sessões que a Julia atendeu como denominador, em vez do total de leads.

## Situação Atual
- **Formula atual**: `Taxa de Conversão = (Conversões / Total de Leads) × 100`
- **Descrição atual**: "X de Y leads"

## Nova Lógica
- **Nova formula**: `Taxa de Conversão = (Conversões / Sessões Julia) × 100`
- **Nova descrição**: "X de Y sessões"

Esta mudança faz sentido porque:
- As sessões Julia representam os atendimentos realizados pela IA
- A conversão deve medir a eficácia dos atendimentos da Julia, não a proporção geral de leads

## Alterações Necessárias

### 1. Dashboard.tsx (linhas 136-151)
Atualizar o cálculo da taxa de conversão:

**Antes:**
```typescript
const conversionRate = useMemo(() => {
  const totalLeads = stats?.totalLeads ?? 0;
  const conversions = stats?.conversions ?? 0;
  if (totalLeads === 0) return 0;
  return (conversions / totalLeads) * 100;
}, [stats?.totalLeads, stats?.conversions]);
```

**Depois:**
```typescript
const conversionRate = useMemo(() => {
  const totalSessions = stats?.totalSessions ?? 0;
  const conversions = stats?.conversions ?? 0;
  if (totalSessions === 0) return 0;
  return (conversions / totalSessions) * 100;
}, [stats?.totalSessions, stats?.conversions]);
```

### 2. Atualizar comparação com período anterior
**Antes:**
```typescript
const prevRate = prevTotal > 0 ? (prevConversions / prevTotal) * 100 : 0;
```

**Depois:**
```typescript
const prevSessions = statsPrevious.totalSessions;
const prevRate = prevSessions > 0 ? (prevConversions / prevSessions) * 100 : 0;
```

### 3. Atualizar descrição do card (linha 199)
**Antes:**
```typescript
description: `${stats?.conversions ?? 0} de ${stats?.totalLeads ?? 0} leads`,
```

**Depois:**
```typescript
description: `${stats?.conversions ?? 0} de ${stats?.totalSessions ?? 0} sessões`,
```

## Impacto
- O card "Taxa de Conversão" no Dashboard refletirá a eficácia da Julia em converter sessões de atendimento em contratos
- O indicador de variação percentual comparará com o período anterior usando a mesma lógica baseada em sessões

## Arquivos a Modificar
- `src/pages/Dashboard.tsx` - 3 pequenas alterações
