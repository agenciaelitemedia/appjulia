

# Plano: Correção da Lógica de Filtragem do FollowUp

## Problema Identificado

O sistema de FollowUp está filtrando leads pela **data de criação** (`created_at`), mas o FollowUp é um **processo contínuo**. Isso causa:

| Cenário | Comportamento Atual | Comportamento Esperado |
|---------|---------------------|------------------------|
| Lead entrou ontem, ainda ativo hoje | Não aparece no filtro "Hoje" | Deveria aparecer (ainda está em processamento) |
| Lead entrou há 7 dias, ainda em FollowUp | Não aparece no filtro "Últimos 7 dias" | Deveria aparecer (ainda está sendo trabalhado) |

O FollowUp trabalha com **ciclos de envio** que podem durar dias ou semanas. Um lead que entrou no dia 01/02 pode ainda estar recebendo mensagens no dia 10/02, mas com o filtro atual ele desaparece da listagem.

---

## Solução Proposta

Implementar uma **lógica híbrida de filtragem**:

1. **Para leads ATIVOS (state = 'SEND')**: Mostrar **independente da data de criação** - são leads em processo
2. **Para leads PARADOS (state = 'STOP')**: Filtrar pela **data de parada** (`send_date` do registro mais recente)
3. **Para o Dashboard**: Usar a mesma lógica para estatísticas coerentes

Alternativa mais simples (recomendada):
- **Fila de Envios**: Alterar o filtro de data para usar `send_date` (data do último evento) ao invés de `created_at`
- **Dashboard**: Manter métricas baseadas em atividade (`send_date` ou `created_at` conforme o KPI)

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/agente/hooks/useFollowupData.ts` | Ajustar filtros de data nas queries |
| `src/pages/agente/followup/FollowupPage.tsx` | Atualizar tooltip explicativo |
| `src/components/filters/UnifiedFilters.tsx` | (Opcional) Adicionar opção para selecionar campo de data |

---

## Detalhamento das Alterações

### 1. Fila de Envios (`useFollowupQueue`)

**Antes**:
```sql
WHERE cod_agent IN (...)
  AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= '2025-02-03'
  AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= '2025-02-03'
```

**Depois** (Opção A - baseado em atividade recente):
```sql
WHERE cod_agent IN (...)
  AND (
    state = 'SEND'  -- Leads ativos sempre aparecem
    OR (
      state = 'STOP' 
      AND (send_date AT TIME ZONE 'America/Sao_Paulo')::date >= '2025-02-03'
      AND (send_date AT TIME ZONE 'America/Sao_Paulo')::date <= '2025-02-03'
    )
  )
```

**Depois** (Opção B - usar `send_date` para todos - mais simples):
```sql
WHERE cod_agent IN (...)
  AND (send_date AT TIME ZONE 'America/Sao_Paulo')::date >= '2025-02-03'
  AND (send_date AT TIME ZONE 'America/Sao_Paulo')::date <= '2025-02-03'
```

A **Opção B** é recomendada por simplicidade e porque `send_date` representa a última atividade do lead.

### 2. Estatísticas do Dashboard (`useFollowupReturnRate`, `useFollowupQueueTotals`)

Mesma lógica: usar `send_date` ao invés de `created_at` para consistência.

### 3. Contagem de Mensagens Enviadas (`useFollowupSentCount`, `useFollowupDailyMetrics`)

Estas já usam `followup_history.created_at` (data real do envio), então estão corretas.

---

## Impacto das Mudanças

| Métrica | Antes | Depois |
|---------|-------|--------|
| Leads na Fila | Só mostra quem entrou no período | Mostra quem teve atividade no período |
| Leads em FollowUp | Pode excluir leads ativos antigos | Inclui todos os leads ativos com atividade recente |
| Taxa de Retorno | Baseada em entrada | Baseada em atividade |

---

## Implementação Passo a Passo

1. **Modificar `useFollowupQueue`** (linhas 213-258)
   - Trocar `created_at` por `send_date` no filtro de data

2. **Modificar `useFollowupQueueStats`** (linhas 261-326)
   - Mesma alteração para consistência

3. **Modificar `useFollowupReturnRate`** (linhas 650-782)
   - Alterar `created_at` para `send_date` no CTE `current_state`
   - Manter `created_at` para `leads_with_response` (data de entrada no followup)

4. **Modificar `useFollowupQueueTotals`** (linhas 597-645)
   - Alterar `created_at` para `send_date`

5. **Atualizar tooltip no FollowupPage** (linhas 330-340)
   - Adicionar `periodTooltip="Filtra pela data da última atividade do lead"`

---

## Considerações Técnicas

### Por que `send_date`?

O campo `send_date` é atualizado sempre que:
- Uma mensagem é enviada
- O lead muda de etapa
- O estado muda (SEND → STOP)

Portanto, representa a **última atividade** do lead no FollowUp.

### Alternativa: Adicionar seletor de campo de filtro

Se o usuário precisar de flexibilidade para escolher entre "data de entrada" e "data de atividade", podemos adicionar um seletor no filtro. Mas isso adiciona complexidade e a maioria dos casos de uso é melhor atendida por `send_date`.

### Retrocompatibilidade

A mudança afeta apenas a visualização/filtragem. Não altera dados no banco.

---

## Teste de Validação

1. Criar um lead no FollowUp no dia anterior
2. Verificar que o lead aparece na listagem de "Hoje" se ainda estiver ativo
3. Verificar que as estatísticas do dashboard incluem o lead
4. Verificar que ao pausar o lead (STOP), ele só aparece no dia da pausa
5. Comparar totais antes/depois para garantir consistência

---

## Resumo

A mudança principal é substituir `created_at` por `send_date` nos filtros de data da fila e estatísticas. Isso reflete melhor a natureza contínua do processo de FollowUp, onde o importante é a **atividade recente**, não a data de entrada.

