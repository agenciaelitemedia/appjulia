## Causa

A migração que adicionou `updated_by` fez `UPDATE crm_deals SET updated_by = ...` em todos os cards para preencher o backfill. O trigger `update_crm_deals_updated_at` (BEFORE UPDATE) reescreveu `updated_at = now()` em cada linha — por isso todos os cards aparecem atualizados no mesmo instante.

## Correção

Nova migração que restaura `updated_at` de cada card a partir do histórico real, com o trigger desabilitado durante a operação.

1. `ALTER TABLE crm_deals DISABLE TRIGGER update_crm_deals_updated_at`
2. `UPDATE crm_deals d SET updated_at = COALESCE(h.last_changed_at, d.created_at)` onde `h` é o `MAX(changed_at)` em `crm_deal_history` por `deal_id`. Cards sem histórico voltam ao `created_at`.
3. `ALTER TABLE crm_deals ENABLE TRIGGER update_crm_deals_updated_at`

Sem alterações em código de aplicação. Próximas atualizações reais (drag, edição, mudança de etapa) continuarão atualizando `updated_at` normalmente via trigger.

## Observação

Cards que nunca tiveram nenhuma ação registrada no histórico vão exibir `updated_at = created_at`, o que é o comportamento esperado ("nunca foi alterado depois de criado").