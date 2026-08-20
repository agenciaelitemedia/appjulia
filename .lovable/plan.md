# Parar reenvio de notificações: card do CRM decide o disparo

## O problema (confirmado nos dados)

O lead `...88860163` recebeu o mesmo alerta de "Cliente parou de responder" às 22:52, 23:24, 23:56 e 00:28 — a cada rodada do cron. Motivo: a chave de anti-duplicidade inclui um "marcador" que muda (o minuto da última mensagem do lead / da mudança de etapa). Quando o marcador muda, o sistema entende que é um alerta novo e reenvia.

## Nova regra de disparo

Antes de enviar qualquer notificação no WhatsApp, o cron consulta o card do lead no CRM de Notificações (por agente + telefone normalizado):

1. **Card existe e está na mesma etapa (mesmo alerta)** → não envia nada; apenas atualiza a data/hora do card.
2. **Card existe em etapa diferente** → move o card para a etapa do alerta atual, atualiza a data/hora e envia a notificação.
3. **Card não existe** → cria o card e envia a notificação normalmente.

Cards já resolvidos (Recuperado / Perdido) não bloqueiam: se o lead voltar a gerar alerta, entra como card novo e a notificação é enviada.

## Detalhes técnicos

- Em `supabase/functions/alert-notifications-cron/index.ts`, substituir o gate atual (busca em `alert_notification_logs` por `dedupe_key`) por um gate baseado em `alert_crm_cards`:
  - buscar card `status = 'open'` por `cod_agent` + `lead_phone_key` (últimos 8 dígitos);
  - se `trigger_key` igual → `update` de `updated_at` (+ nome/etapa CRM se mudou) e `continue` sem enviar;
  - se `trigger_key` diferente → `update` de `trigger_key`, `stage_entered_at`, `updated_at` e segue para o envio;
  - se não há card → cria o card (etapa do alerta) e segue para o envio.
- O card passa a ser criado/movido **antes** do envio (hoje só é criado quando `status === 'sent'`), garantindo que o gate funcione mesmo se o envio falhar; o `log_id` do disparo é gravado no card depois do envio.
- `alert_notification_logs` continua sendo gravado como histórico por destinatário. O índice único atual `(cod_agent, trigger_key, dedupe_key, recipient_phone)` continua como proteção contra execuções simultâneas do cron.
- Nenhuma mudança de banco necessária; nenhuma alteração na tela ou no módulo de Notificações de Contrato.
