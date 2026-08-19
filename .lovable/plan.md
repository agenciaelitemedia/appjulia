# Notificações e Alertas (Julia Closer)

Novo módulo com tela própria para configurar **quem recebe no WhatsApp** cada situação do atendimento e **qual mensagem** é enviada, mais o disparo real dos 3 gatilhos que hoje não existem.

## Módulo e navegação

- Novo módulo configurável no permissionamento: código `notifications_alerts`, nome **Notificações e Alertas**, ícone `BellRing`, rota `/notificacoes-alertas`, grupo de menu `AGENTES DA JULIA`.
- Auto-registro no primeiro acesso (mesmo padrão dos outros módulos), então já aparece no menu e na matriz de permissões sem cadastro manual.
- Rota protegida pelo módulo, seguindo o padrão das demais telas.

## Tela

Cabeçalho com seletor de **Agente da Julia** (mesmo componente da tela de Notificações de Contrato) e duas abas:

1. **Geral** — vazia por enquanto (placeholder informando que o painel de visão geral vem depois).
2. **Configurar Alertas** — um cartão por situação:

| Situação | Modo padrão | Quem recebe |
|---|---|---|
| Cliente parou de responder (recuperação) | Assumir (takeover) | equipe de recuperação |
| Qualificado | Assumir | closer / advogado |
| Desqualificado | Notificar | gestor de qualidade |
| Contrato em curso | Assumir | responsável (já dispara hoje — só leitura/atalho) |
| Contrato assinado | Assumir | advogado (já dispara hoje — só leitura/atalho) |
| Fim de fluxo sem destino (erro) | Notificar | número do admin |

Cada cartão tem: liga/desliga, modo (**Notificar** = Julia continua ativa · **Assumir** = Julia é pausada naquele contato), lista de números de WhatsApp (adicionar/remover, com máscara), e editor da mensagem padrão com variáveis clicáveis:

`{lead_nome}` `{lead_whatsapp}` `{data_hora}` `{situacao}` `{resumo_conversa}` `{caso}` `{link_chat}`

Mensagem padrão sugerida:

```text
🔔 *{situacao}*

👤 Lead: {lead_nome}
📱 WhatsApp: {lead_whatsapp}
🕒 {data_hora}
📌 Caso: {caso}

📝 Resumo:
{resumo_conversa}
```

Os dois gatilhos de contrato ficam exibidos como “já ativos” e apontam para a tela de Notificações de Contrato, sem alterar o comportamento atual.

## Disparo dos 3 gatilhos que faltam

- **Parou de responder**: detectado quando entra pré-followup/followup para a sessão do lead (mesmo sinal do ícone de recuperação no painel).
- **Qualificado / Desqualificado**: detectado pela mudança de etapa do lead no CRM da Julia; na tela o usuário escolhe quais etapas representam “Qualificado” e “Desqualificado”.
- Envio pelo mesmo canal já usado hoje (credenciais do agente + adaptador de mensagens), com registro em histórico e proteção anti-duplicidade (um disparo por lead por gatilho, com reset quando o lead volta a interagir).
- No modo **Assumir**, além da mensagem, a Julia é pausada naquele contato usando o controle de sessão que já existe.

## Detalhes técnicos

- Tabelas novas no backend:
  - `alert_notification_configs` — `cod_agent`, `trigger_key`, `is_active`, `mode` (`notify` | `takeover`), `recipients jsonb`, `message_template`, `stage_ids jsonb` (para qualificado/desqualificado), timestamps + trigger de `updated_at`; RLS + GRANTs no mesmo padrão das demais tabelas do projeto.
  - `alert_notification_logs` — `config_id`, `trigger_key`, `cod_agent`, `lead_phone`, `lead_name`, `recipient_phone`, `message_text`, `status`, `error_message`, `sent_at`; usada para deduplicação e histórico.
- Frontend: `src/pages/notificacoes-alertas/` (página + `GeralTab`, `ConfigurarAlertasTab`, `AlertTriggerCard`), hook `src/hooks/useAlertNotificationConfigs.ts`, hook de auto-registro `useEnsureAlertsModule.ts`, rota em `App.tsx`.
- Backend: edge function `alert-notifications-cron` — consulta o Postgres legado (`followup_queue`/`followup_queue_temp`, `crm_atendimento_cards` + `crm_atendimento_stages`, `sessions`, `log_messages` para o resumo), monta a mensagem e envia; agendada por `pg_cron` a cada 2 minutos, espelhando `contract-notifications-cron`.
- Nada nas funções de contrato existentes é alterado.
