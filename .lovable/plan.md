

## Clarificar Filtro de Data no CRM com Tooltip Explicativo

### Objetivo
Adicionar um tooltip explicativo ao label "Período" nos filtros, indicando que o CRM filtra pela **data da última movimentação do lead** (`stage_entered_at`), e não pela data de criação.

---

## Análise da Situação Atual

O CRM **já filtra corretamente por `stage_entered_at`**:
- Um lead criado em 26/01 mas movimentado em 27/01 aparece quando o filtro está em "Hoje" (27/01)
- A query SQL já usa: `(c.stage_entered_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date`

O que falta é **clareza visual** para o usuário entender esse comportamento.

---

## Mudanças a Implementar

### 1. Adicionar prop opcional para tooltip no UnifiedFilters

**Arquivo:** `src/components/filters/types.ts`

Adicionar nova prop opcional:

```typescript
export interface UnifiedFiltersProps {
  // ... props existentes ...
  
  // Tooltip explicativo para o filtro de período
  periodTooltip?: string;
}
```

---

### 2. Adicionar tooltip ao label "Período"

**Arquivo:** `src/components/filters/UnifiedFilters.tsx`

Importar componentes de tooltip e adicionar ao label:

```typescript
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
```

No JSX, alterar a seção de "Período:" (linha 220):

```typescript
{/* Quick Period Buttons */}
{showQuickPeriods && (
  <div className="px-4 py-3 border-b border-border/50 bg-muted/20">
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide mr-1 flex items-center gap-1">
        Período:
        {periodTooltip && (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p>{periodTooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </span>
      {/* ... resto dos botões de período ... */}
    </div>
  </div>
)}
```

---

### 3. Passar o tooltip na página do CRM

**Arquivo:** `src/pages/crm/CRMPage.tsx`

Adicionar a prop `periodTooltip` ao componente UnifiedFilters:

```typescript
<UnifiedFilters
  agents={agents}
  filters={filters}
  onFiltersChange={setFilters}
  isLoading={agentsLoading}
  periodTooltip="Filtra pela data da última movimentação do lead no pipeline (não pela data de criação)"
/>
```

---

### 4. Adicionar tooltip também nas subpáginas do CRM

**Arquivos:** 
- `src/pages/crm/statistics/CRMStatisticsPage.tsx`
- `src/pages/crm/monitoring/CRMMonitoringPage.tsx`

Aplicar o mesmo tooltip para consistência:

```typescript
<UnifiedFilters
  agents={agents}
  filters={filters}
  onFiltersChange={setFilters}
  isLoading={agentsLoading}
  periodTooltip="Filtra pela data da última movimentação do lead no pipeline"
/>
```

---

## Resultado Visual Esperado

```text
┌─────────────────────────────────────────────────────────────────┐
│ 🔍 Filtros                                        [3 agentes]   │
├─────────────────────────────────────────────────────────────────┤
│ Período: ⓘ   [Hoje] [Ontem] [7 dias] [Semana] [30 dias] ...    │
│                ↓                                                 │
│    ┌─────────────────────────────────────────────────┐          │
│    │ Filtra pela data da última movimentação do      │          │
│    │ lead no pipeline (não pela data de criação)     │          │
│    └─────────────────────────────────────────────────┘          │
├─────────────────────────────────────────────────────────────────┤
│ [Agentes ▼] [De: 27/01/2026] [Até: 27/01/2026] [Buscar...]     │
└─────────────────────────────────────────────────────────────────┘
```

O ícone ⓘ (Info) aparece ao lado de "Período:" e ao passar o mouse, exibe o tooltip explicativo.

---

## Resumo das Alterações

| Arquivo | Ação |
|---------|------|
| `src/components/filters/types.ts` | Adicionar prop `periodTooltip?: string` |
| `src/components/filters/UnifiedFilters.tsx` | Renderizar tooltip com ícone Info ao lado de "Período:" |
| `src/pages/crm/CRMPage.tsx` | Passar texto do tooltip explicando o filtro por última movimentação |
| `src/pages/crm/statistics/CRMStatisticsPage.tsx` | Aplicar mesmo tooltip para consistência |
| `src/pages/crm/monitoring/CRMMonitoringPage.tsx` | Aplicar mesmo tooltip para consistência |

---

## Benefícios

1. **Clareza**: Usuários entendem que o filtro considera a última movimentação
2. **Consistência**: Segue o padrão de tooltips já usado em outras partes do sistema
3. **Flexibilidade**: A prop é opcional, então outras páginas que usam UnifiedFilters não são afetadas
4. **Não invasivo**: Pequeno ícone que só mostra informação quando o usuário interage

