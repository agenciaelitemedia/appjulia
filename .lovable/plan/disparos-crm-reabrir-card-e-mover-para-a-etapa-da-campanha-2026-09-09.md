# Disparos → CRM: reabrir card e mover para a etapa da campanha

## Por que não criou o lead (verificado)

A campanha "Teste crm" estava com a inclusão no CRM ligada (painel + etapa escolhidos) e o envio foi feito. O registro do disparo mostra `deal_exists`: já havia um card do telefone `5534988860163` naquele painel, então nada foi criado nem movido.

Esse card existente está **arquivado** e em outra etapa. A regra atual só ignora cards "perdidos" — arquivado, ganho e concluído contavam como card ativo e bloqueavam a criação.

## Novas regras

Para cada destinatário enviado com sucesso, no painel escolhido:

1. **Contato**: nunca duplica. Procura pelo telefone (com e sem o 9º dígito) no mesmo escritório; usa o existente ou cria um novo.
2. **Card existente ativo** (em qualquer etapa do painel escolhido): não cria outro — **move para a etapa escolhida na campanha**, atualiza a data de entrada na etapa, coloca no fim da coluna, aplica o responsável da campanha (se houver) e registra a movimentação no histórico. Se já estiver na etapa escolhida, apenas registra o toque da campanha.
3. **Card excluído, arquivado, em perda ou em ganho**: não conta como existente — **um novo card é criado** na etapa escolhida.
4. Tudo filtrado pelo escritório (client_id) da campanha; erro no CRM nunca derruba o envio.

## Detalhes técnicos

`supabase/functions/_shared/dsp-crm-push.ts`:

- Busca de card existente: `client_id` + `board_id` + `contact_phone in variants` + `status = 'open'` (hoje é `neq status 'lost'`), ordenado por `updated_at desc`.
- Quando encontra:
  - se `pipeline_id !== campaign.crm_pipeline_id`: `update` de `pipeline_id`, `stage_entered_at = now`, `position` = último da coluna destino + 1, `assigned_to` (só se a campanha definir), `updated_by = dsp:<campaign_id>`; insere `crm_deal_history` com `action: 'stage_changed'`, `from_pipeline_id`, `to_pipeline_id`, nota citando a campanha;
  - se já está na etapa: apenas `crm_deal_history` com nota da campanha (sem alterar etapa).
  - retorno passa a distinguir `moved` / `already_in_stage` de `created`.
- Quando não encontra card ativo (inclui arquivado/ganho/perdido/inexistente): fluxo atual de criação, sem mudanças.
- Resolução de contato permanece igual (reaproveita `contact_id`, busca por variantes, cria por último) — garante contato único.

`supabase/functions/dsp-campaign-worker/index.ts`: o `event_type` gravado em `dsp_message_events` passa a refletir o resultado (`crm_card_created`, `crm_card_moved`, `crm_card_error`). Nenhuma alteração no envio, limites, janela ou rotação.

Sem migração de banco. Verificação: `bunx tsgo --noEmit`, deploy de `dsp-campaign-worker` e um reteste da campanha com o mesmo telefone (deve criar card novo, já que o atual está arquivado).
