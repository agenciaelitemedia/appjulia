# Janela de 10 minutos para os alertas

Hoje os gatilhos varrem janelas largas (2 dias para CRM/sem resposta, 30 dias para contratos) e só o dedupe evita repetição. A mudança passa a exigir que o evento seja **recente** — no máximo 10 minutos além do momento em que ficou elegível.

## Regras novas

| Gatilho | Elegível quando |
|---|---|
| Cliente parou de responder | Última mensagem é do nosso lado e foi enviada há **>= X min** e **< X + 10 min** (X = "Minutos sem resposta do lead") |
| Lead qualificado | Card está numa etapa de qualificado e entrou nessa etapa há **<= 10 min** |
| Lead desqualificado | Mesma regra, com as etapas de desqualificado |
| Contrato em curso | Contrato criado/enviado há **<= 10 min** |
| Contrato assinado | Assinatura registrada há **<= 10 min** |

Fim de fluxo sem destino fica como está.

## Efeito prático

- O alerta sai perto do acontecimento; se o cron perder a janela (fora do ar por mais de 10 min), aquele lead não gera alerta atrasado.
- Como o cron roda a cada 2 minutos, a janela de 10 minutos dá cerca de 5 tentativas — o dedupe/card continua garantindo um único envio.

## Detalhes técnicos

Tudo em `supabase/functions/alert-notifications-cron/index.ts` (sem mudança de schema nem de UI):

- Constante `RECENT_WINDOW_MS = 10 * 60_000`.
- `fetchNoResponseCandidates`: substituir o piso de 2 dias pela janela dupla — descartar quando `lastMessageMs + minutes*60_000 > now` (ainda não venceu) e quando `lastMessageMs + (minutes+10)*60_000 < now` (venceu há muito).
- `fetchCandidates` (`qualified` / `disqualified`): trocar `>= NOW() - INTERVAL '2 days'` por `>= NOW() - INTERVAL '10 minutes'` sobre `COALESCE(c.stage_entered_at, c.updated_at)`.
- `fetchCandidates` / contratos legados (`sing_document`): trocar `created_at >= NOW() - INTERVAL '30 days'` por `INTERVAL '10 minutes'`; em `contract_signed` usar a data de assinatura quando existir (`signed_at`/`updated_at`), com fallback para `created_at`.
- `fetchXJContractCandidates`: `contract_in_progress` filtra `created_at >= agora - 10 min`; `contract_signed` filtra `signed_at >= agora - 10 min` (contratos marcados como assinados sem `signed_at` ficam de fora, por não terem data confiável).
- `syncXJContractSignatures` continua varrendo 30 dias — é ele que preenche `signed_at`, e o alerta dispara no ciclo seguinte, já dentro da janela.
- Redeploy da edge function.