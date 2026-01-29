
# Plano: Indicador de Horário + Resumo + Ocultação Condicional

## Objetivo
Implementar três melhorias relacionadas ao sistema de horário de atendimento:

1. **Indicador visual na listagem** - mostrar se agente está dentro/fora do expediente
2. **Resumo na página de detalhes** - exibir configuração de horário de forma legível
3. **Ocultação condicional no formulário** - esconder campos quando horário desativado

---

## 1. Indicador Visual na Listagem de Agentes

### Problema
A listagem atual não inclui os dados de `settings` do agente, portanto não é possível calcular se está no horário.

### Solução

**1.1. Atualizar Query do Backend** (`supabase/functions/db-query/index.ts`)

Modificar a query `get_agents_list` para incluir o campo `settings`:

```sql
SELECT 
  a.id,
  a.cod_agent,
  a.status,
  a.settings,  -- NOVO: adicionar settings para business hours
  c.name AS client_name,
  c.business_name,
  ...
```

**1.2. Atualizar Interface** (`src/pages/agents/hooks/useAgentsList.ts`)

Adicionar `settings` à interface `AgentListItem`:

```typescript
export interface AgentListItem {
  // ... campos existentes
  settings: Record<string, unknown> | null;
}
```

**1.3. Criar Utilitário de Verificação** (novo arquivo)

Criar `src/lib/businessHoursUtils.ts` com função reutilizável:

```typescript
interface BusinessHoursResult {
  enabled: boolean;
  isWithinHours: boolean;
  currentDayEnabled: boolean;
}

export function checkBusinessHours(settings: Record<string, unknown> | null): BusinessHoursResult
```

**1.4. Criar Componente de Badge** (novo componente)

Criar `src/components/BusinessHoursBadge.tsx`:

```text
┌────────────────────────┐
│ 🟢 Aberto              │  (dentro do horário)
│ 🔴 Fechado             │  (fora do horário)
│ 🔵 24h                 │  (BUSINESS_HOURS_ENABLED=false)
└────────────────────────┘
```

**1.5. Adicionar Coluna na Tabela** (`src/pages/agents/AgentsList.tsx`)

- Nova coluna "Horário" após "Status"
- Exibe `BusinessHoursBadge` com base nos settings do agente

### Visual da Tabela

```text
| Status | Horário  | Cod. Agente | Nome/Escritório | ...
|--------|----------|-------------|-----------------|
| [ON]   | 🟢 Aberto | 202501001   | Empresa ABC    |
| [OFF]  | 🔴 Fechado| 202501002   | Empresa XYZ    |
| [ON]   | 🔵 24h    | 202501003   | Empresa 123    |
```

---

## 2. Resumo na Página de Detalhes do Agente

### Arquivo: `src/pages/agents/AgentDetailsPage.tsx`

**2.1. Adicionar novo Card** (após "Informações do Agente")

```text
┌─────────────────────────────────────────────────────────────────────┐
│  🕐 Horário de Atendimento                                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Status: 🟢 Ativo  |  Fuso: Brasília (GMT-3)  |  Agora: 🟢 Aberto   │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  • Segunda a Sexta: 08:00 - 18:00                                   │
│  • Sábado: Fechado                                                  │
│  • Domingo: Fechado                                                 │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  Mensagem fora do horário:                                          │
│  "Olá! No momento estamos fora do horário de atendimento..."        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Se horário desabilitado:**

```text
┌─────────────────────────────────────────────────────────────────────┐
│  🕐 Horário de Atendimento                                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Status: Desativado (atendimento 24h)                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**2.2. Criar Componente Auxiliar**

Criar `src/pages/agents/components/BusinessHoursSummary.tsx`:
- Props: `settings: Record<string, unknown>`
- Extrai e formata os dados de BUSINESS_HOURS_*
- Agrupa dias consecutivos com mesmo horário (ex: "Segunda a Sexta")
- Exibe o status atual (dentro/fora do horário)

---

## 3. Ocultação Condicional no Formulário

### Arquivo: `src/pages/agents/components/wizard-steps/ConfigStep.tsx`

**Comportamento Atual:**
Todos os campos de horário ficam desabilitados (opacity reduzida) quando `BUSINESS_HOURS_ENABLED=false`

**Novo Comportamento:**
Quando `BUSINESS_HOURS_ENABLED=false`, ocultar completamente os campos:
- Fuso Horário
- BusinessHoursEditor (grid de dias)
- Mensagem Fora do Horário

**Alteração no JSX:**

```tsx
{/* Business Hours Section */}
<Card>
  <CardHeader>
    <CardTitle>Horário de Atendimento</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Toggle - sempre visível */}
    <div className="flex items-center justify-between">
      <div>
        <FormLabel>Ativar Horário Comercial</FormLabel>
        <FormDescription>Limitar atendimento a horários específicos</FormDescription>
      </div>
      <Switch
        checked={config.BUSINESS_HOURS_ENABLED}
        onCheckedChange={(checked) => updateField('BUSINESS_HOURS_ENABLED', checked)}
      />
    </div>

    {/* Campos condicionais - só aparecem se ativado */}
    {config.BUSINESS_HOURS_ENABLED && (
      <>
        <Separator />
        {/* Fuso Horário */}
        ...
        <Separator />
        {/* BusinessHoursEditor */}
        ...
        <Separator />
        {/* Mensagem Fora do Horário */}
        ...
      </>
    )}
  </CardContent>
</Card>
```

---

## Arquivos a Modificar/Criar

| # | Arquivo | Ação |
|---|---------|------|
| 1 | `supabase/functions/db-query/index.ts` | Adicionar `settings` na query `get_agents_list` |
| 2 | `src/pages/agents/hooks/useAgentsList.ts` | Adicionar `settings` à interface |
| 3 | `src/lib/businessHoursUtils.ts` | **CRIAR** - Função utilitária para verificar horário |
| 4 | `src/components/BusinessHoursBadge.tsx` | **CRIAR** - Badge de status de horário |
| 5 | `src/pages/agents/AgentsList.tsx` | Adicionar coluna de Horário |
| 6 | `src/pages/agents/components/BusinessHoursSummary.tsx` | **CRIAR** - Componente de resumo |
| 7 | `src/pages/agents/AgentDetailsPage.tsx` | Adicionar Card de horário |
| 8 | `src/pages/agents/components/wizard-steps/ConfigStep.tsx` | Renderização condicional |

---

## Detalhes Técnicos

### Função `checkBusinessHours`

```typescript
// src/lib/businessHoursUtils.ts

interface DaySchedule {
  enabled: boolean;
  start: string;
  end: string;
}

interface BusinessHoursSchedule {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

interface BusinessHoursResult {
  enabled: boolean;        // BUSINESS_HOURS_ENABLED
  isWithinHours: boolean;  // Está dentro do horário agora?
  currentDayEnabled: boolean;  // Hoje está configurado como dia de atendimento?
  timezone: string;
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function checkBusinessHours(settings: Record<string, unknown> | null): BusinessHoursResult {
  // Se settings é null ou BUSINESS_HOURS_ENABLED é false, retorna "sempre aberto"
  if (!settings || !settings.BUSINESS_HOURS_ENABLED) {
    return { enabled: false, isWithinHours: true, currentDayEnabled: true, timezone: '' };
  }

  const timezone = (settings.BUSINESS_HOURS_TIMEZONE as string) || 'America/Sao_Paulo';
  const schedule = settings.BUSINESS_HOURS_SCHEDULE as BusinessHoursSchedule;

  if (!schedule) {
    return { enabled: true, isWithinHours: true, currentDayEnabled: true, timezone };
  }

  // Usar Intl.DateTimeFormat para obter dia/hora no timezone configurado
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23'
  });

  const now = new Date();
  const parts = formatter.formatToParts(now);
  
  const weekdayPart = parts.find(p => p.type === 'weekday')?.value;
  const hourPart = parts.find(p => p.type === 'hour')?.value || '00';
  const minutePart = parts.find(p => p.type === 'minute')?.value || '00';

  const dayMap: Record<string, string> = {
    'Sun': 'sunday', 'Mon': 'monday', 'Tue': 'tuesday',
    'Wed': 'wednesday', 'Thu': 'thursday', 'Fri': 'friday', 'Sat': 'saturday'
  };

  const currentDay = dayMap[weekdayPart || 'Mon'];
  const currentTime = `${hourPart}:${minutePart}`;
  const daySchedule = schedule[currentDay as keyof BusinessHoursSchedule];

  if (!daySchedule?.enabled) {
    return { enabled: true, isWithinHours: false, currentDayEnabled: false, timezone };
  }

  const isWithin = currentTime >= daySchedule.start && currentTime <= daySchedule.end;
  return { enabled: true, isWithinHours: isWithin, currentDayEnabled: true, timezone };
}
```

### Componente `BusinessHoursBadge`

```tsx
// src/components/BusinessHoursBadge.tsx

interface BusinessHoursBadgeProps {
  settings: Record<string, unknown> | null;
  showLabel?: boolean;
}

export function BusinessHoursBadge({ settings, showLabel = true }: BusinessHoursBadgeProps) {
  const result = checkBusinessHours(settings);

  if (!result.enabled) {
    // 24h - sem restrição de horário
    return (
      <Badge variant="outline" className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {showLabel && '24h'}
      </Badge>
    );
  }

  if (result.isWithinHours) {
    return (
      <Badge variant="default" className="flex items-center gap-1 bg-green-600">
        <CheckCircle className="h-3 w-3" />
        {showLabel && 'Aberto'}
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="flex items-center gap-1">
      <XCircle className="h-3 w-3" />
      {showLabel && 'Fechado'}
    </Badge>
  );
}
```

---

## Impacto

- **Performance**: A query de listagem agora traz o campo `settings` (JSONB), mas é apenas leitura sem processamento extra no backend
- **UX**: Indicador visual claro do status de atendimento em tempo real
- **Manutenibilidade**: Função utilitária centralizada, mesma lógica usada no frontend e replicada no n8n
- **Formulário**: Interface mais limpa - campos só aparecem quando relevantes
