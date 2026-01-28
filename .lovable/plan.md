
# Plano: Implementar Interface de Horário de Atendimento no ConfigStep

## Objetivo
Adicionar uma nova seção de "Horário de Atendimento" no componente `ConfigStep.tsx` que permite configurar os dias e horários em que o agente estará disponível para atendimento.

## Arquivos a Modificar/Criar

### 1. Criar Componente: `BusinessHoursEditor.tsx`

**Caminho:** `src/pages/agents/components/wizard-steps/BusinessHoursEditor.tsx`

Novo componente dedicado para o editor de horários por dia da semana.

**Estrutura do componente:**
- Interface `DaySchedule`: { enabled: boolean, start: string, end: string }
- Interface `BusinessHoursSchedule`: Record com os 7 dias da semana
- Props: schedule, onChange, disabled
- Renderiza grid com os 7 dias, cada um com:
  - Checkbox para ativar/desativar o dia
  - Input type="time" para horário inicial
  - Input type="time" para horário final
  - Visual desabilitado quando o dia está inativo

**Dias da semana (labels em português):**
```typescript
const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Segunda-feira' },
  { key: 'tuesday', label: 'Terça-feira' },
  { key: 'wednesday', label: 'Quarta-feira' },
  { key: 'thursday', label: 'Quinta-feira' },
  { key: 'friday', label: 'Sexta-feira' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];
```

### 2. Atualizar `ConfigStep.tsx`

**Caminho:** `src/pages/agents/components/wizard-steps/ConfigStep.tsx`

**Mudanças na interface `ConfigFields`:**
Adicionar os novos campos de horário de atendimento:

```typescript
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

interface ConfigFields {
  // ... campos existentes ...
  BUSINESS_HOURS_ENABLED: boolean;
  BUSINESS_HOURS_TIMEZONE: string;
  BUSINESS_HOURS_SCHEDULE: BusinessHoursSchedule;
  BUSINESS_HOURS_OFF_MESSAGE: string;
}
```

**Mudanças no `DEFAULT_CONFIG`:**
```typescript
const DEFAULT_BUSINESS_HOURS_SCHEDULE: BusinessHoursSchedule = {
  monday: { enabled: true, start: '08:00', end: '18:00' },
  tuesday: { enabled: true, start: '08:00', end: '18:00' },
  wednesday: { enabled: true, start: '08:00', end: '18:00' },
  thursday: { enabled: true, start: '08:00', end: '18:00' },
  friday: { enabled: true, start: '08:00', end: '17:00' },
  saturday: { enabled: false, start: '09:00', end: '13:00' },
  sunday: { enabled: false, start: '00:00', end: '00:00' },
};

const DEFAULT_CONFIG: ConfigFields = {
  // ... campos existentes ...
  BUSINESS_HOURS_ENABLED: false,
  BUSINESS_HOURS_TIMEZONE: 'America/Sao_Paulo',
  BUSINESS_HOURS_SCHEDULE: DEFAULT_BUSINESS_HOURS_SCHEDULE,
  BUSINESS_HOURS_OFF_MESSAGE: 'Olá! No momento estamos fora do horário de atendimento. Nosso horário de funcionamento é de segunda a sexta, das 08:00 às 18:00. Retornaremos assim que possível!',
};
```

**Nova seção no JSX (novo Card após "Sessão e Campanha"):**

```text
┌─────────────────────────────────────────────────────────────────────┐
│  🕐 Horário de Atendimento                                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Ativar Horário Comercial                              [Toggle]     │
│  Limitar atendimento a horários específicos                         │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  Fuso Horário                                                       │
│  [America/Sao_Paulo - Brasília (GMT-3)                     ▼]       │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  <BusinessHoursEditor />  (grid com os 7 dias)                      │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  Mensagem Fora do Horário                                           │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ Textarea com a mensagem automática                            │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Novos imports necessários:**
- Clock (lucide-react) - ícone para o card
- Select, SelectContent, SelectItem, SelectTrigger, SelectValue - para fuso horário
- BusinessHoursEditor - novo componente

**Lista de fusos horários brasileiros:**
```typescript
const TIMEZONES = [
  { value: 'America/Sao_Paulo', label: 'Brasília (GMT-3)' },
  { value: 'America/Manaus', label: 'Manaus (GMT-4)' },
  { value: 'America/Cuiaba', label: 'Cuiabá (GMT-4)' },
  { value: 'America/Belem', label: 'Belém (GMT-3)' },
  { value: 'America/Fortaleza', label: 'Fortaleza (GMT-3)' },
  { value: 'America/Recife', label: 'Recife (GMT-3)' },
  { value: 'America/Rio_Branco', label: 'Rio Branco (GMT-5)' },
  { value: 'America/Porto_Velho', label: 'Porto Velho (GMT-4)' },
];
```

## Componente BusinessHoursEditor - Detalhes

**Visual do grid:**
```text
┌────────────────────────────────────────────────────────────┐
│ [✓] Segunda-feira      [08:00] ─ [18:00]                   │
│ [✓] Terça-feira        [08:00] ─ [18:00]                   │
│ [✓] Quarta-feira       [08:00] ─ [18:00]                   │
│ [✓] Quinta-feira       [08:00] ─ [18:00]                   │
│ [✓] Sexta-feira        [08:00] ─ [17:00]                   │
│ [ ] Sábado             [09:00] ─ [13:00]  (esmaecido)      │
│ [ ] Domingo            [--:--] ─ [--:--]  (esmaecido)      │
└────────────────────────────────────────────────────────────┘
```

**Comportamento:**
- Quando o checkbox está desmarcado, os inputs de horário ficam desabilitados e com opacidade reduzida
- Quando BUSINESS_HOURS_ENABLED está false, todo o BusinessHoursEditor fica desabilitado
- Inputs do tipo "time" para seleção nativa de horário

## Fluxo de Dados

1. `ConfigStep` lê o `config_json` do formulário
2. Faz parse e extrai os campos de BUSINESS_HOURS_*
3. Passa o schedule para `BusinessHoursEditor`
4. Quando o usuário modifica, o componente chama onChange
5. `ConfigStep` atualiza o JSON completo via `updateField`

## Resumo das Tarefas

| # | Arquivo | Ação |
|---|---------|------|
| 1 | `BusinessHoursEditor.tsx` | Criar novo componente |
| 2 | `ConfigStep.tsx` | Expandir interfaces e DEFAULT_CONFIG |
| 3 | `ConfigStep.tsx` | Adicionar imports (Clock, Select, BusinessHoursEditor) |
| 4 | `ConfigStep.tsx` | Adicionar novo Card de Horário de Atendimento |

## Impacto

- Nenhuma alteração de schema necessária (usa campo `settings` existente)
- Compatível com configurações existentes (merge com defaults)
- O n8n/Julia já terá acesso aos novos campos via settings JSON
- Interface segue o padrão visual existente do ConfigStep
