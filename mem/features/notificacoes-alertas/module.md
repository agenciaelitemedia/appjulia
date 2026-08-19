---
name: Notificações e Alertas
description: Módulo isolado de alertas WhatsApp por gatilho do atendimento (6 gatilhos, múltiplos destinatários, modo notificar/assumir)
type: feature
---
Módulo `notifications_alerts` em `src/modules/notificacoes-alertas/` (rota `/notificacoes-alertas`, menu AGENTES DA JULIA).

- Padrão obrigatório para módulos novos: código isolado na pasta do módulo; qualquer reuso de outros módulos/sistema passa por `extend/` (db, auth, agents, julia, masks).
- 6 gatilhos por agente (`cod_agent`): `no_response`, `qualified`, `disqualified`, `contract_in_progress`, `contract_signed`, `flow_error`. Os dois de contrato são detectados por este módulo, independentes do módulo Notificações de Contrato (que segue intacto).
- Cada gatilho: liga/desliga, modo `notify` (Julia segue ativa) ou `takeover` (pausa a Julia + para followups), **vários números de WhatsApp**, template com `{lead_nome} {lead_whatsapp} {data_hora} {situacao} {resumo_conversa} {caso} {link_chat}`, e etapas do CRM (qualified/disqualified).
- `no_response` usa **silêncio real das mensagens** (não a `followup_queue`): `chat_conversations` com `last_message_from_me = true` e `last_customer_message_at` >= `no_response_minutes` atrás (coluna configurável por gatilho, padrão 30 min, janela máx. 2 dias). Dedupe = `phone:nores:minutos:marker(minuto do último msg do lead)`.
- Tabelas: `alert_notification_configs` (unique cod_agent+trigger_key) e `alert_notification_logs` (1 linha por destinatário; `dedupe_key` evita repetir o mesmo lead/gatilho).
- Disparo: edge `alert-notifications-cron`, pg_cron `alert-notifications-every-2min` (*/2). Resumo vem de `chat_conversation_summaries`/`chat_messages` (Supabase) — `log_messages` no banco legado NÃO tem conteúdo de mensagem (só id, session_id, type, created_at).
