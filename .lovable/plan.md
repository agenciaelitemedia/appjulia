

# Plano: Indicador de FollowUp nos Cards do CRM

## Objetivo

Adicionar ao card do CRM um indicador visual mostrando que o lead está em FollowUp ativo, exibindo:
- Ícone ⏳ em vermelho com efeito de fade (pulse)
- Badge com etapa atual no formato `[Etapa X/Y]`
- Para FollowUp infinito: `[Etapa ∞/∞]` ou `[Etapa X/∞]`

---

## Análise da View vw_send_followup_queue

Campos disponíveis:
- `cod_agent` - Código do agente
- `session_id` - ID da sessão (vinculada ao WhatsApp na tabela sessions)
- `step_number` - Etapa atual do followup
- `node_count` - Total de etapas configuradas
- `state` - Status ('SEND', 'QUEUE', 'STOP')
- `followup_from` - Etapa inicial do loop infinito (null se não configurado)
- `followup_to` - Etapa final do loop infinito (null se não configurado)
- `created_at` - Data de criação do registro

---

## Estratégia de Performance

### Opção Escolhida: Query Batch com LEFT JOIN

Em vez de fazer N queries (uma por card), faremos **uma única query** que busca todos os leads em FollowUp para os agentes filtrados, depois fazemos o match no cliente.

```text
┌─────────────────────────────────────────────────────────────┐
│  CRMPage                                                    │
│  └── useFollowupActiveLeads(agentCodes) ← NOVA QUERY        │
│      └── Retorna Map<whatsapp+cod_agent, FollowupInfo>      │
│  └── CRMPipeline                                            │
│      └── CRMPipelineColumn                                  │
│          └── CRMLeadCard                                    │
│              └── followupInfo = map.get(key) ← LOOKUP O(1)  │
└─────────────────────────────────────────────────────────────┘
```

Vantagens:
- **Uma única query** no carregamento (não importa quantos cards)
- Lookup O(1) para cada card via Map
- Dados cacheados pelo React Query
- Não bloqueia o render dos cards

---

## Dados Necessários

A query buscará todos os leads em FollowUp ativo (state = 'SEND'):

```sql
WITH ranked_followup AS (
  SELECT 
    fq.cod_agent::text as cod_agent,
    s.whatsapp_number::text as whatsapp,
    fq.step_number,
    fq.node_count,
    fq.followup_from,
    fq.followup_to,
    fq.created_at,
    ROW_NUMBER() OVER (
      PARTITION BY fq.cod_agent, s.whatsapp_number 
      ORDER BY fq.created_at DESC
    ) as rn
  FROM vw_send_followup_queue fq
  INNER JOIN sessions s ON s.id = fq.session_id::int
  WHERE fq.cod_agent::text = ANY($1::varchar[])
    AND fq.state = 'SEND'
)
SELECT cod_agent, whatsapp, step_number, node_count, followup_from, followup_to
FROM ranked_followup
WHERE rn = 1
```

---

## Interface TypeScript

### Novo tipo para dados de FollowUp

```typescript
// types.ts
export interface CRMFollowupInfo {
  cod_agent: string;
  whatsapp: string;
  step_number: number;
  node_count: number;
  followup_from: number | null;
  followup_to: number | null;
  is_infinite: boolean;
  stage_label: string; // "1/4", "∞/∞", "2/∞"
}
```

---

## Novo Hook

### Arquivo: `src/pages/crm/hooks/useFollowupActiveLeads.ts`

```typescript
export function useFollowupActiveLeads(agentCodes: string[]) {
  return useQuery({
    queryKey: ['crm-followup-active', agentCodes],
    queryFn: async () => {
      if (!agentCodes.length) return new Map();
      
      const result = await externalDb.raw<FollowupActiveRow>({
        query: `...`, // Query SQL acima
        params: [agentCodes],
      });
      
      // Transformar em Map para lookup O(1)
      const map = new Map<string, CRMFollowupInfo>();
      result.forEach(row => {
        const key = `${row.cod_agent}::${row.whatsapp}`;
        const isInfinite = row.followup_from !== null && 
                          row.followup_to !== null;
        const hasReachedInfinite = isInfinite && 
                                   row.step_number >= row.followup_to;
        
        let stageLabel: string;
        if (hasReachedInfinite) {
          stageLabel = '∞/∞';
        } else if (isInfinite) {
          stageLabel = `${row.step_number}/∞`;
        } else {
          stageLabel = `${row.step_number}/${row.node_count}`;
        }
        
        map.set(key, {
          ...row,
          is_infinite: isInfinite,
          stage_label: stageLabel,
        });
      });
      
      return map;
    },
    enabled: agentCodes.length > 0,
    staleTime: 1000 * 60, // Cache por 1 minuto
  });
}
```

---

## Alterações no Componente

### CRMPage.tsx

Adicionar chamada do novo hook e passar para o Pipeline:

```tsx
const { data: followupMap = new Map() } = useFollowupActiveLeads(filters.agentCodes);

<CRMPipeline
  stages={stages}
  cards={filteredCards}
  onCardClick={handleCardClick}
  followupMap={followupMap}  // Passar o map
/>
```

### CRMPipeline.tsx

Propagar o map para as colunas:

```tsx
interface CRMPipelineProps {
  stages: CRMStage[];
  cards: CRMCard[];
  onCardClick: (card: CRMCard) => void;
  followupMap?: Map<string, CRMFollowupInfo>;  // Adicionar prop
}
```

### CRMPipelineColumn.tsx

Propagar para os cards:

```tsx
<CRMLeadCard
  key={card.id}
  card={card}
  onClick={() => onCardClick(card)}
  followupInfo={followupMap?.get(`${card.cod_agent}::${card.whatsapp_number}`)}
/>
```

### CRMLeadCard.tsx

Exibir o indicador abaixo do tempo na fase:

```tsx
interface CRMLeadCardProps {
  card: CRMCard;
  onClick: () => void;
  apiCredentials?: {...};
  followupInfo?: CRMFollowupInfo;  // Adicionar prop
}

// No JSX, após o "Na fase:"
{followupInfo && (
  <div className="flex items-center gap-1.5 pt-1">
    <span className="text-red-500 animate-pulse">⏳</span>
    <Badge 
      variant="outline" 
      className="text-[10px] font-medium px-1.5 py-0 bg-red-500/10 text-red-600 border-red-500/30"
    >
      Etapa {followupInfo.stage_label}
    </Badge>
  </div>
)}
```

---

## Visual Final

```text
┌─────────────────────────────────────────────────────────────┐
│  👤 Maria Silva                         [📹][💬][📋][👁]    │
│     +55 11 99999-9999                                       │
│  # [ABC123] - Escritório X                                  │
│─────────────────────────────────────────────────────────────│
│  Criado: 01/02/26 14:30                                     │
│  Atualizado: 05/02/26 09:15                                 │
│  ⏰ Na fase: 3 dias                                          │
│  ⏳ [Etapa 2/4]              ← INDICADOR FOLLOWUP           │
│                                   🇧🇷 Horário de Brasília    │
└─────────────────────────────────────────────────────────────┘
```

Variações do badge:
- `[Etapa 1/4]` - FollowUp normal, etapa 1 de 4
- `[Etapa 2/∞]` - FollowUp infinito, ainda não chegou no loop
- `[Etapa ∞/∞]` - FollowUp infinito, já está no loop

---

## Arquivos a Criar/Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/crm/hooks/useFollowupActiveLeads.ts` | **NOVO** - Hook para buscar leads em FollowUp ativo |
| `src/pages/crm/types.ts` | Adicionar interface `CRMFollowupInfo` |
| `src/pages/crm/CRMPage.tsx` | Chamar novo hook e passar map |
| `src/pages/crm/components/CRMPipeline.tsx` | Propagar followupMap |
| `src/pages/crm/components/CRMPipelineColumn.tsx` | Propagar para cards |
| `src/pages/crm/components/CRMLeadCard.tsx` | Exibir indicador visual |

---

## Estilo do Ícone

O ícone ⏳ terá efeito de fade via `animate-pulse` do Tailwind:
- Cor vermelha (`text-red-500`)
- Animação de pulse para chamar atenção
- Badge com fundo vermelho translúcido (`bg-red-500/10`)

---

## Considerações de Performance

1. **Uma query para todos os cards**: Evita N+1 queries
2. **Map para lookup**: O(1) por card em vez de O(n) com filter
3. **React Query cache**: Dados ficam em cache por 1 minuto
4. **Query independente**: Não bloqueia o carregamento dos cards (paralelo)
5. **Enabled condition**: Query só executa se houver agentCodes

---

## Lógica de Exibição

```typescript
// Determinar se está em followup infinito
const isInfinite = followup_from !== null && followup_to !== null;

// Determinar se já chegou na etapa do loop infinito
const hasReachedInfinite = isInfinite && step_number >= followup_to;

// Formatar label
if (hasReachedInfinite) {
  return '∞/∞';
} else if (isInfinite) {
  return `${step_number}/∞`;
} else {
  return `${step_number}/${node_count}`;
}
```

