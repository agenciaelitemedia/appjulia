
# Plano: Corrigir Ausencia de Historico de Movimentacao

## Diagnostico

Apos analise dos logs de rede, identifiquei que:

1. **A query esta funcionando corretamente** - A requisicao a `crm_atendimento_history` retorna sem erro
2. **A tabela esta vazia para os cards** - Response: `{"data":[], "error":null}`
3. **Sistema externo nao registra historico** - O bot "JulIA" move os leads automaticamente (campo `notes: "Movido automaticamente pela JulIA"`), mas nao insere registros na tabela de historico

### Evidencia
```
Card 3783:
- created_at: "2026-01-23T00:52:11" (Entrada)
- stage_entered_at: "2026-01-23T00:53:51" (Analise de Caso)
- stage_id: 3 (mudou de 1 para 3)
- notes: "Movido automaticamente pela JulIA"
- Historico: VAZIO
```

O card foi criado e depois movido de fase, mas o historico nao foi registrado porque o sistema JulIA atualiza diretamente o banco sem passar pela nossa funcao `useMoveCard`.

---

## Solucoes Possiveis

### Opcao A: Correcao no Backend Externo (Recomendado)
Modificar o sistema JulIA para inserir registros na tabela `crm_atendimento_history` sempre que mover um lead.

**Pros:** Solucao definitiva, historico completo
**Contras:** Requer acesso ao codigo do backend JulIA

### Opcao B: Trigger no Banco de Dados
Criar um trigger PostgreSQL que insere automaticamente no historico sempre que `stage_id` for alterado em `crm_atendimento_cards`.

```sql
CREATE OR REPLACE FUNCTION log_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    INSERT INTO crm_atendimento_history (
      card_id, from_stage_id, to_stage_id, changed_by, changed_at
    ) VALUES (
      NEW.id, OLD.stage_id, NEW.stage_id, 'Sistema JulIA', NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_log_stage_change
AFTER UPDATE ON crm_atendimento_cards
FOR EACH ROW
EXECUTE FUNCTION log_stage_change();
```

**Pros:** Automatico, captura todas as mudancas
**Contras:** Requer acesso ao banco externo para criar o trigger

### Opcao C: Historico Simulado (Workaround)
Exibir um historico "inferido" baseado nas informacoes do card (`created_at` e `stage_entered_at`).

**Pros:** Funciona imediatamente sem alteracoes externas
**Contras:** Historico incompleto (apenas ultimo movimento), nao mostra de/para

---

## Plano de Implementacao - Opcao C (Workaround Imediato)

Enquanto a correcao no backend externo nao e feita, implementar um historico inferido:

### 1. Atualizar `CRMLeadDetailsDialog.tsx`

Adicionar logica para exibir um historico sintetico quando a tabela estiver vazia:

```typescript
// Se nao ha historico real, mostrar info sintetica baseada no card
const syntheticHistory = useMemo(() => {
  if (history.length > 0 || !card) return null;
  
  // Se stage_entered_at != created_at, houve pelo menos uma mudanca
  const enteredAt = new Date(card.stage_entered_at).getTime();
  const createdAt = new Date(card.created_at).getTime();
  
  if (enteredAt > createdAt + 60000) { // Diferenca > 1 minuto
    return [{
      id: 0,
      card_id: card.id,
      from_stage_id: null,
      to_stage_id: card.stage_id,
      from_stage_name: null,
      to_stage_name: currentStage?.name,
      to_stage_color: currentStage?.color,
      changed_by: 'Sistema JulIA',
      changed_at: card.stage_entered_at,
      notes: card.notes || 'Movimentacao automatica',
    }];
  }
  
  return null;
}, [history, card, currentStage]);

const displayHistory = history.length > 0 ? history : syntheticHistory || [];
```

### 2. Adicionar Entrada Inicial

Mostrar tambem quando o lead foi criado (entrada no sistema):

```typescript
// Adicionar entrada de criacao
const creationEntry = {
  id: -1,
  card_id: card.id,
  from_stage_id: null,
  to_stage_id: 1, // Entrada
  from_stage_name: null,
  to_stage_name: 'Entrada',
  to_stage_color: '#3B82F6',
  changed_by: 'Sistema',
  changed_at: card.created_at,
  notes: 'Lead criado via WhatsApp',
};
```

### 3. Indicar Historico Incompleto

Mostrar aviso quando o historico e sintetico:

```typescript
{syntheticHistory && (
  <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded mb-2 flex items-center gap-1">
    <AlertTriangle className="h-3 w-3" />
    Historico parcial - apenas ultima movimentacao registrada
  </div>
)}
```

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/crm/components/CRMLeadDetailsDialog.tsx` | Adicionar logica de historico sintetico e aviso |

---

## Resultado Esperado

- Usuario vera pelo menos a entrada inicial e a ultima movimentacao
- Aviso visual indicando que o historico esta incompleto
- Sistema continua funcionando mesmo sem dados na tabela de historico

---

## Recomendacao a Longo Prazo

Para ter historico completo, sera necessario:
1. Criar o trigger no banco PostgreSQL externo, OU
2. Modificar o sistema JulIA para registrar movimentacoes

Isso esta fora do escopo deste projeto frontend, mas e a solucao definitiva.
