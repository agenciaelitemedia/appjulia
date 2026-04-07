

# Mover card do CRM Julia para "Desqualificado" ao excluir contrato

## Resumo

Ao excluir um contrato, após marcar como DELETED, buscar o card correspondente no CRM da Julia (tabela externa `crm_atendimento_cards`) pelo `whatsapp_number` e `cod_agent`, e movê-lo para a etapa "Desqualificado". Registrar histórico da movimentação.

## Alteração: `src/pages/estrategico/contratos/components/ContratosTable.tsx`

Na função `handleDeleteContrato`, após o insert na `contract_deletion_audit`, adicionar:

1. Buscar o ID da stage "Desqualificado" na tabela externa `crm_atendimento_stages`:
```typescript
const stages = await externalDb.raw({
  query: `SELECT id FROM crm_atendimento_stages WHERE name = 'Desqualificado' LIMIT 1`,
});
```

2. Se encontrou a stage, buscar o card pelo whatsapp e cod_agent:
```typescript
const cards = await externalDb.raw({
  query: `SELECT id, stage_id FROM crm_atendimento_cards WHERE whatsapp_number = $1 AND cod_agent = $2 LIMIT 1`,
  params: [deleteContrato.whatsapp, deleteContrato.cod_agent],
});
```

3. Se encontrou o card, mover para "Desqualificado" e registrar histórico:
```typescript
await externalDb.update({
  table: 'crm_atendimento_cards',
  data: { stage_id: desqualificadoStageId, stage_entered_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  where: { id: cardId },
});

await externalDb.insert({
  table: 'crm_atendimento_history',
  data: { card_id: cardId, from_stage_id: fromStageId, to_stage_id: desqualificadoStageId, changed_by: 'Sistema', notes: 'Movido para Desqualificado — contrato excluído' },
});
```

4. Invalidar queries do CRM Julia também: `queryClient.invalidateQueries({ queryKey: ['crm-cards'] })`

Toda a lógica é envolvida em try/catch separado para não impedir a exclusão caso o card não exista no CRM.

## Arquivo alterado

| Arquivo | Mudança |
|---|---|
| `ContratosTable.tsx` | Adicionar movimentação do card para "Desqualificado" no `handleDeleteContrato` |

