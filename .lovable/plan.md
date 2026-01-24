
# Plano: Badge Único de Etapa + Indicador de FollowUp Infinito

## Resumo
Refatorar o badge de etapa para exibição única com cor suave, adicionar símbolo de infinito (∞) quando o FollowUp é configurado como loop infinito (from/to preenchidos), e implementar na configuração a funcionalidade de seleção de etapas from/to para criar ciclos de reengajamento.

---

## Entendimento da Regra de Negócio

### FollowUp Infinito
- Quando `followup_from` e `followup_to` estão preenchidos no banco, significa que ao chegar na etapa X (`followup_to`), o lead volta para a etapa Y (`followup_from`)
- Isso cria um loop infinito de reengajamento
- **Regra de validação**: `followup_from` deve ser **menor** que `followup_to` (voltar para uma etapa anterior)
- Exemplo: Se `from=2` e `to=5`, ao completar etapa 5, volta para etapa 2

### Interface na Configuração
- Duas listas (selects) ao lado do horário de execução
- Lista "De" (from): etapas disponíveis como destino (exceto a última)
- Lista "Para" (to): etapas que acionam o loop (apenas etapas posteriores ao "from")

---

## Alterações por Arquivo

### 1. src/pages/agente/types.ts

**Adicionar campo is_infinite ao tipo enriquecido:**
```typescript
export interface FollowupQueueItemEnriched extends FollowupQueueItem {
  total_steps: number;
  derived_status: 'sent' | 'waiting' | 'stopped';
  is_infinite: boolean;  // NOVO: indica se é followup infinito
}
```

---

### 2. src/pages/agente/followup/FollowupPage.tsx

**Mudanças:**
- Extrair `followup_from` e `followup_to` do config
- Calcular `is_infinite = followup_from !== null && followup_to !== null`
- Passar `is_infinite` para cada item enriquecido
- Ajustar lógica de `getDerivedStatus` para considerar loop infinito (nunca é "enviado" se infinito)

**Nova lógica de status:**
```typescript
function getDerivedStatus(
  item: FollowupQueueItem, 
  totalSteps: number,
  isInfinite: boolean
): 'sent' | 'waiting' | 'stopped' {
  if (item.state === 'STOP') return 'stopped';
  // Se é infinito, nunca considera como "enviado" (sempre volta)
  if (!isInfinite && item.state === 'SEND' && item.step_number >= totalSteps) return 'sent';
  return 'waiting';
}
```

---

### 3. src/pages/agente/followup/components/FollowupQueue.tsx

**Substituir StepBadge por versão unificada:**

```typescript
// Novo componente de badge único com cor suave
function StepBadge({ current, total, isInfinite }: { current: number; total: number; isInfinite: boolean }) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      <Badge 
        variant="secondary" 
        className="text-xs px-2.5 py-0.5 bg-primary/10 text-primary border-primary/20"
      >
        {current} / {total}
      </Badge>
      {isInfinite && (
        <span className="text-primary text-lg font-light" title="FollowUp Infinito">
          ∞
        </span>
      )}
    </div>
  );
}
```

**Atualizar props e uso:**
- Receber `isInfinite` do item enriquecido
- Passar para o componente StepBadge

---

### 4. src/pages/agente/followup/components/FollowupConfig.tsx

**Adicionar estados:**
```typescript
const [followupFrom, setFollowupFrom] = useState<number | null>(null);
const [followupTo, setFollowupTo] = useState<number | null>(null);
const [isInfiniteEnabled, setIsInfiniteEnabled] = useState(false);
```

**Carregar do config:**
```typescript
useEffect(() => {
  if (config) {
    // ... código existente ...
    setFollowupFrom(config.followup_from);
    setFollowupTo(config.followup_to);
    setIsInfiniteEnabled(config.followup_from !== null && config.followup_to !== null);
  }
}, [config]);
```

**Nova seção de UI (após horários):**
```text
+----------------------------------------------------------+
|  Horário de Envio: [09:00] às [19:00]                    |
|                                                          |
|  [x] Ativar FollowUp Infinito                            |
|      Ao chegar na etapa [Etapa 4 - Dia 3] ─────────────  |
|      Voltar para      [Etapa 2 - Reforço] ─────────────  |
+----------------------------------------------------------+
```

**Validação:**
- "Ao chegar na etapa" (to): mostra etapas 2 até N
- "Voltar para" (from): mostra etapas 1 até (to - 1)
- Quando `to` muda, validar se `from` ainda é válido

**Salvar:**
```typescript
onSave({
  // ... campos existentes ...
  followup_from: isInfiniteEnabled ? followupFrom : null,
  followup_to: isInfiniteEnabled ? followupTo : null,
});
```

---

## Interface Visual

### Badge de Etapa na Fila
```text
Antes:  [2] / [4]     (dois badges separados)
Depois: [2 / 4] ∞     (badge único + símbolo infinito quando aplicável)
```

### Configuração do Loop Infinito
```text
┌─────────────────────────────────────────────────────────┐
│  Configurações Gerais                                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  [x] Mensagem Automática                                │
│                                                          │
│  Horário de Envio: [09:00▼] às [19:00▼]                 │
│                                                          │
│  ─────────────────────────────────────────────────────  │
│                                                          │
│  [x] Ativar FollowUp Infinito (Loop)                    │
│                                                          │
│  Quando chegar na etapa:                                │
│  [  Etapa 4 - Dia 3             ▼]                      │
│                                                          │
│  Voltar para a etapa:                                   │
│  [  Etapa 2 - Reforço           ▼]                      │
│                                                          │
│  ℹ️ O lead será reengajado continuamente até responder  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Fluxo de Dados

```text
FollowupPage
    |
    |-- useFollowupConfig() -> config
    |       |-- followup_from: number | null
    |       |-- followup_to: number | null
    |
    |-- Calcular isInfinite = (from !== null && to !== null)
    |
    |-- Enriquecer items com is_infinite
    |
    +-- FollowupQueue
    |       |-- StepBadge({ current, total, isInfinite })
    |       |       |-- Badge único: "2 / 4"
    |       |       |-- Símbolo ∞ se isInfinite
    |
    +-- FollowupConfig
            |-- isInfiniteEnabled (switch)
            |-- followupTo (select: etapas 2..N)
            |-- followupFrom (select: etapas 1..to-1)
```

---

## Validações de Negócio

### No Frontend (FollowupConfig)
1. `followup_from` deve ser menor que `followup_to`
2. Quando desativar o switch, limpar ambos valores (null)
3. Quando mudar `to`, validar se `from` ainda é válido
4. Se `from >= to`, resetar `from` para primeira opção válida

### Opções dos Selects
- **"Ao chegar na etapa" (to)**: Etapas 2 até N (não faz sentido na primeira)
- **"Voltar para" (from)**: Etapas 1 até (to - 1)

---

## Ordem de Implementação

1. **types.ts**
   - Adicionar `is_infinite` ao `FollowupQueueItemEnriched`

2. **FollowupPage.tsx**
   - Extrair `followup_from` e `followup_to` do config
   - Calcular `isInfinite`
   - Ajustar `getDerivedStatus` para loop infinito
   - Passar `is_infinite` aos items enriquecidos

3. **FollowupQueue.tsx**
   - Refatorar `StepBadge` para badge único com cor suave
   - Adicionar símbolo ∞ quando `isInfinite`

4. **FollowupConfig.tsx**
   - Adicionar estados `followupFrom`, `followupTo`, `isInfiniteEnabled`
   - Inicializar do config
   - Criar seção de UI com switch e selects
   - Implementar validação de from < to
   - Atualizar `handleSave` para incluir os campos

---

## Seção Técnica

### Cores do Badge Único
- Background: `bg-primary/10` (10% da cor primária)
- Texto: `text-primary`
- Borda: `border-primary/20`

### Símbolo de Infinito
- Usar caractere Unicode: `∞` (U+221E)
- Cor: `text-primary`
- Tamanho: `text-lg`
- Tooltip: "FollowUp Infinito"

### Geração das Opções dos Selects
```typescript
// Para "Ao chegar na etapa" (to)
const toOptions = steps.slice(1).map((step, index) => ({
  value: index + 2,  // etapas 2, 3, 4...
  label: `Etapa ${index + 2} - ${step.title}`,
}));

// Para "Voltar para" (from) - depende do to selecionado
const fromOptions = steps.slice(0, (followupTo || 2) - 1).map((step, index) => ({
  value: index + 1,  // etapas 1, 2, 3... até to-1
  label: `Etapa ${index + 1} - ${step.title}`,
}));
```

### Campos do Banco
- `followup_from`: smallint (pode ser null)
- `followup_to`: smallint (pode ser null)
- Quando ambos preenchidos = loop infinito ativo
