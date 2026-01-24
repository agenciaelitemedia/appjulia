

# Plano: Corrigir Interpretacao de Timestamps do Banco de Dados

## Diagnostico do Problema

### Evidencia dos Dados

Analisando a resposta da API:
```json
"created_at": "2026-01-23T20:38:26.254Z"
```

O card mostra **17:38**, mas o usuario confirma que foi criado as **20:38**.

### Causa Raiz

O problema NAO esta no frontend, mas na **forma como os dados sao armazenados**:

1. O sistema externo (JulIA) salva o horario de Brasilia (20:38) diretamente no banco
2. O banco armazena como se fosse UTC (com sufixo `Z`)
3. O frontend recebe `20:38Z` (UTC) e converte para Brasilia: `20:38 - 3h = 17:38`

**O dado ja esta em horario de Brasilia, mas esta marcado como UTC.**

### Fluxo Atual (Incorreto)

```text
Horario Real: 20:38 Brasilia
       |
       v
Banco salva: "2026-01-23T20:38:26" (sem offset, assumido UTC)
       |
       v
API retorna: "2026-01-23T20:38:26.254Z" (Z = UTC)
       |
       v
Frontend converte: new Date("...Z") -> interpreta como UTC
       |
       v
formatDateTimeSaoPaulo: UTC 20:38 - 3h = 17:38 Brasilia
       |
       v
Usuario ve: 17:38 (ERRADO!)
```

---

## Solucao

Como NAO temos controle sobre como o sistema externo (JulIA) insere os dados, precisamos **interpretar os timestamps como Brasilia, nao como UTC**.

### Estrategia

Criar uma funcao que "corrige" a interpretacao do timestamp:
1. Remove o sufixo `Z` do ISO string
2. Interpreta como horario local de Brasilia
3. Formata corretamente

### Alteracoes

#### 1. Adicionar funcao de correcao em `src/lib/dateUtils.ts`

```typescript
/**
 * Interpreta um timestamp do banco como se ja estivesse em Brasilia.
 * 
 * PROBLEMA: O sistema externo salva horarios de Brasilia como UTC.
 * Exemplo: 20:38 Brasilia e salvo como "2026-01-23T20:38:26Z"
 *          Quando parseado, JavaScript interpreta como UTC e converte errado.
 * 
 * SOLUCAO: Remover o Z e tratar como timestamp sem timezone,
 *          depois formatar explicitamente para Brasilia.
 */
export function parseDbTimestamp(dateStr: string): Date {
  // Remove o Z final se existir (para nao interpretar como UTC)
  const cleanStr = dateStr.replace(/Z$/, '');
  
  // Cria data local sem conversao de timezone
  // Adiciona o offset de Brasilia manualmente
  const localDate = new Date(cleanStr);
  
  // Como o timestamp ja esta em Brasilia mas foi salvo sem offset,
  // precisamos ajustar: adicionar o offset UTC que o JavaScript subtrai
  // Brasilia = UTC-3, entao o JS vai subtrair 3h do offset local
  // Para compensar, nao fazemos nada se o offset local for igual a Brasilia
  
  return localDate;
}

/**
 * Formata um timestamp do banco para exibicao.
 * Use esta funcao para timestamps que vem do banco externo.
 */
export function formatDbDateTime(dateStr: string): string {
  // Remove Z para interpretar como horario local (que ja e Brasilia)
  const cleanStr = dateStr.replace(/Z$/, '');
  const date = new Date(cleanStr);
  
  // Agora formata SEM conversao de timezone (ja esta em Brasilia)
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Formata apenas hora de um timestamp do banco.
 */
export function formatDbTime(dateStr: string): string {
  const cleanStr = dateStr.replace(/Z$/, '');
  const date = new Date(cleanStr);
  
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
```

#### 2. Atualizar `src/pages/crm/components/CRMLeadCard.tsx`

Substituir `formatDateTimeSaoPaulo` por `formatDbDateTime`:

```typescript
import { formatDbDateTime } from '@/lib/dateUtils';

// Linha 116
<span>{formatDbDateTime(card.created_at)}</span>

// Linha 120
<span>{formatDbDateTime(card.updated_at)}</span>
```

#### 3. Atualizar `src/pages/crm/components/CRMLeadDetailsDialog.tsx`

Usar `formatDbDateTime` para todos os timestamps:

```typescript
import { formatDbDateTime } from '@/lib/dateUtils';

// Substituir formatDateTimeSaoPaulo por formatDbDateTime
```

#### 4. Atualizar `src/pages/crm/monitoring/components/ActivityTimeline.tsx`

Atualizar formatacao de `changed_at`:

```typescript
import { formatDbTime, formatDbDateTime } from '@/lib/dateUtils';

// Usar formatDbTime para hora e formatDbDateTime para data completa
```

#### 5. Atualizar `src/pages/crm/components/WhatsAppMessagesDialog.tsx`

As mensagens do WhatsApp podem ter timestamps diferentes. Verificar se tambem precisam do mesmo tratamento.

---

## Resumo das Alteracoes

| Arquivo | Alteracao |
|---------|-----------|
| `src/lib/dateUtils.ts` | Adicionar `formatDbDateTime`, `formatDbTime`, `parseDbTimestamp` |
| `src/pages/crm/components/CRMLeadCard.tsx` | Usar `formatDbDateTime` |
| `src/pages/crm/components/CRMLeadDetailsDialog.tsx` | Usar `formatDbDateTime` |
| `src/pages/crm/monitoring/components/ActivityTimeline.tsx` | Usar novas funcoes |

---

## Consideracoes Importantes

1. **Dados legados**: Esta solucao assume que TODOS os timestamps do banco externo estao salvos em Brasilia sem offset
2. **Novos registros**: O codigo em `useMoveCard` usa `new Date().toISOString()` que salva em UTC real - precisamos verificar se isso e consistente
3. **Migracao futura**: Idealmente, o sistema externo deveria ser corrigido para salvar timestamps com timezone correto

---

## Resultado Esperado

- Card criado as 20:38 mostrara **20:38** (nao mais 17:38)
- Consistencia visual em toda a aplicacao
- Indicador "Horario de Brasilia" continua valido

