

# Corrigir Tabela, Colunas, Status e Janela Temporal nas Edge Functions

## Problemas atuais

1. **Tabela errada**: `julia_sessions_contracts` — deve ser `sing_document`
2. **Status errados**: `'Gerado'`/`'Assinado'` — deve ser `'CREATED'`/`'SIGNED'`
3. **Colunas erradas**: `whatsapp` → `whatsapp_number`, `name` → `signer_name`, `resumo_do_caso` → `resume_case`, `data_contrato` → `created_at`, JOIN com `case_categories` → usar `document_case` direto
4. **Janela fixa de 30 dias**: se a soma das cadências ultrapassar 30 dias, o contrato some da query antes de completar todas as etapas

## Solucao para a janela temporal

Em vez de `created_at >= NOW() - INTERVAL '30 days'` fixo, calcular dinamicamente a janela máxima necessária baseado na configuração de cadência do agente. A lógica:

- Para cada config ativa do agente, somar todos os intervalos das etapas (`step_cadence`)
- Usar o maior valor total como janela da query
- Adicionar margem de segurança (