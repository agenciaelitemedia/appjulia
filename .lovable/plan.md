
# Plano: Formatar Tempo Médio em Horas (com Dias se > 24h)

## Objetivo
Modificar o card "Tempo Médio" no CRM para exibir o tempo em horas, e quando ultrapassar 24 horas, mostrar no formato "Xd Yh" (dias e horas).

---

## Situação Atual

O cálculo atual já retorna o tempo em dias (linha 35-43):
```typescript
const days = (now.getTime() - entered.getTime()) / (1000 * 60 * 60 * 24);
```

E a exibição mostra apenas em dias (linha 135):
```typescript
<p className="text-2xl font-bold text-foreground">{stats.avgTime.toFixed(1)}d</p>
```

---

## Solução

Criar uma função auxiliar `formatAvgTime` que:
1. Converte dias para horas (multiplicar por 24)
2. Se < 24 horas: exibe "Xh" (ex: "8h", "23h")
3. Se >= 24 horas: exibe "Xd Yh" (ex: "1d 12h", "3d 5h")

---

## Arquivo a Modificar

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/crm/components/CRMDashboardSummary.tsx` | Adicionar função de formatação e atualizar exibição |

---

## Detalhamento Técnico

### Função de Formatação

```typescript
const formatAvgTime = (days: number): string => {
  const totalHours = days * 24;
  
  if (totalHours < 24) {
    return `${Math.round(totalHours)}h`;
  }
  
  const fullDays = Math.floor(totalHours / 24);
  const remainingHours = Math.round(totalHours % 24);
  
  if (remainingHours === 0) {
    return `${fullDays}d`;
  }
  
  return `${fullDays}d ${remainingHours}h`;
};
```

### Atualização do Card

```tsx
{/* 3. Tempo Médio */}
<Card className="border-l-4 border-l-chart-3">
  <CardContent className="p-4">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs text-muted-foreground font-medium">Tempo Médio</p>
        <p className="text-2xl font-bold text-foreground">{formatAvgTime(stats.avgTime)}</p>
        <p className="text-xs text-muted-foreground">na fase atual</p>
      </div>
      ...
    </div>
  </CardContent>
</Card>
```

---

## Exemplos de Exibição

| Valor em dias | Horas totais | Exibição |
|---------------|--------------|----------|
| 0.25 | 6h | **6h** |
| 0.5 | 12h | **12h** |
| 0.95 | 22.8h | **23h** |
| 1.0 | 24h | **1d** |
| 1.5 | 36h | **1d 12h** |
| 2.75 | 66h | **2d 18h** |
| 5.0 | 120h | **5d** |

---

## Resultado Esperado

1. Tempos menores que 24 horas exibem apenas horas (ex: "8h")
2. Tempos iguais ou maiores que 24 horas exibem dias e horas (ex: "2d 5h")
3. Se as horas restantes forem 0, exibe apenas dias (ex: "3d")
