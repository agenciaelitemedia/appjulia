# Contratos nos alertas: incluir os contratos do X-Julia

## Como funciona hoje

Os gatilhos **Contrato em curso** e **Contrato assinado** olham apenas o fluxo antigo: a tabela `sing_document` do banco legado, filtrando pelo agente, `status_document = CREATED` (em curso) ou `SIGNED` (assinado), documentos dos últimos 30 dias. Cada contrato notifica no máximo uma vez por status. Contratos gerados pelos agentes X-Julia não são vistos por esses alertas.

## O que muda

Os dois gatilhos passam a considerar **duas fontes**: o fluxo legado (como hoje) e os contratos do X-Julia. Um contrato do X-Julia entra em:

- **Contrato em curso** — quando foi enviado para assinatura e ainda não foi assinado.
- **Contrato assinado** — quando a assinatura é confirmada.

A anti-duplicidade continua por contrato + status, então um mesmo contrato nunca repete o mesmo aviso, e o mesmo lead pode receber "em curso" e depois "assinado".

## Ponto que precisa ser resolvido

Hoje nenhum contrato do X-Julia chega ao status "assinado" automaticamente — só se alguém marcar manualmente na tela de contratos. Sem resolver isso, o alerta de "Contrato assinado" nunca dispararia para o X-Julia.

Solução incluída no plano: o próprio cron dos alertas passa a **conferir na ZapSign** o status dos contratos enviados e ainda não assinados (poucos por rodada, dos últimos 30 dias), gravando data de assinatura e status assinado quando a ZapSign confirmar. Isso também deixa a tela de contratos do X-Julia com status correto, sem depender de webhook externo.

## Detalhes técnicos

- `supabase/functions/alert-notifications-cron/index.ts`
  - Nova função `fetchXJContractCandidates(supabase, codAgent, triggerKey)`:
    - resolve o `client_id` (escritório) do agente, igual ao que já é feito no gatilho `no_response`;
    - consulta `xj_contracts` por `client_id` e `created_at >= now() - 30 dias`;
    - em curso: `status = 'sent'` e `signed_at is null`; assinado: `status = 'signed'` ou `signed_at is not null`;
    - monta `Candidate` com `leadPhone = signer_phone`, `leadName = signer_name`, `caso` via `case_id` (`xj_legal_cases.name`), `sessionId` apenas quando houver sessão legada equivalente (senão `null`), `dedupeKey = xj:<contract_id>:<status>`.
  - No bloco atual de `contract_in_progress` / `contract_signed`, concatenar o resultado legado com o do X-Julia (legado primeiro), deduplicando por `dedupeKey`.
  - Antes de coletar candidatos de contrato, chamar `syncXJContractSignatures(supabase, clientId)`: para até ~20 contratos `status = 'sent'` com `external_id` e `provider = 'zapsign'`, consultar o documento na ZapSign e, quando assinado, atualizar `status = 'signed'` + `signed_at`.
  - `takeover` (pausar a Julia) só é aplicado quando existe sessão legada; contratos X-Julia sem sessão legada apenas notificam.
- `supabase/functions/_shared/x-julia/zapsign.ts`: expor um helper `fetchZapSignDocStatus(token, external_id)` (se ainda não existir) para o cron não duplicar a lógica de token/autenticação.
- Sem mudança de schema, sem mudança na tela do módulo e sem mexer no módulo antigo de Notificações de Contrato.
- Redeploy de `alert-notifications-cron` no final.