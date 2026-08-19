# CRM de Notificações: cards não criados para alertas já enviados

## Diagnóstico (confirmado nos dados)

- `alert_notification_logs` tem **354 alertas com status `sent`**, a maioria entre 20:00 e 21:00 UTC de hoje (130 `no_response`, 70 `qualified`, 25 `disqualified`, além de contratos mais cedo).
- `alert_crm_cards` só tem **7 cards**, todos criados a partir de 21:44 UTC — ou seja, só depois que a lógica de criação de card entrou no ar.
- Causa: o card só é criado no momento do envio do alerta. Os alertas anteriores já ficaram registrados nos logs, e a anti-duplicidade por `dedupe_key` faz o cron pular esses leads para sempre. Resultado: aqueles leads **nunca** geram card, mesmo continuando elegíveis.

## O que fazer

1. **Garantir o card mesmo quando o alerta é pulado**
   No cron, quando já existe log para (agente, gatilho, `dedupe_key`), em vez de simplesmente ignorar o lead, garantir que o card exista/esteja na coluna correta antes de seguir. Assim o CRM passa a refletir o estado real, sem reenviar WhatsApp.

2. **Backfill dos alertas já enviados**
   Criar os cards retroativos a partir dos logs `sent`, respeitando as regras atuais:
   - um card aberto por (agente, últimos 8 dígitos do telefone);
   - em caso de vários alertas para o mesmo lead, vale o mais recente (define a coluna/gatilho e o `stage_entered_at`);
   - preencher `client_id`, `cod_agent`, `lead_name`, `lead_phone`, `lead_phone_key`, `log_id`, `status = open`.

3. **Validar na tela**
   Conferir na aba CRM de Notificações que as colunas dos gatilhos ficam populadas com o filtro de período do dia, sem duplicidade de lead.

## Detalhes técnicos

- Arquivo: `supabase/functions/alert-notifications-cron/index.ts` — mover a chamada de `upsertAlertCrmCard` para também ocorrer no caminho "log já existente" (usando o `log_id` encontrado), mantendo `phoneKey()` como chave.
- Backfill: operação de dados sobre `alert_notification_logs` → `alert_crm_cards`, agrupando por `cod_agent` + `right(regexp_replace(lead_phone,'\D','','g'),8)` e pegando o log mais recente por grupo; `ON CONFLICT` do índice único de card aberto garante idempotência.
- Frontend (`useAlertCrmCards`) filtra por `created_at` do card; os cards do backfill serão criados hoje, então aparecem no filtro padrão do dia. Nenhuma mudança de UI necessária.
