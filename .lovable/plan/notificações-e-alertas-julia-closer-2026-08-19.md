# Notificações e Alertas (Julia Closer)

Novo módulo **isolado** (padrão para todos os módulos novos) com tela própria para configurar **quem recebe no WhatsApp** cada situação do atendimento e **qual mensagem** é enviada. Os **6 gatilhos** do documento — incluindo os dois de contrato — funcionam dentro deste módulo, de forma independente do que já existe hoje em Notificações de Contrato (que continua intacto).

## Módulo e navegação

- Módulo configurável no permissionamento: código `notifications_alerts`, nome **Notificações e Alertas**, ícone `BellRing`, rota `/notificacoes-alertas`, grupo de menu `AGENTES DA JULIA`.
- Auto-registro no primeiro acesso, então já aparece no menu e na matriz de permissões sem cadastro manual.
- Rota protegida pelo módulo.

## Arquitetura isolada (padrão para novos módulos)

Todo o código vive em `src/modules/notificacoes-alertas/`, seguindo o padrão já usado em `x-julia` e `escritorios`:

```text
src/modules/notificacoes-alertas/
  module.ts            metadados (code, rota, ícone, menu, gatilhos)
  types.ts
  extend/              único ponto de contato com o resto do sistema
    db.ts              supabase + externalDb
    auth.ts            useAuth / permissões
    agents.ts          seletor de agentes da Julia
    julia.ts           controle de sessão (pausar Julia no takeover)
  hooks/
  components/
  pages/NotificacoesAlertasPage.tsx
```

Regra: nada fora da pasta importa arquivos internos do módulo, e nada dentro do módulo importa de outros módulos sem passar por `extend/`.

## Tela

Cabeçalho com seletor de **Agente da Julia** e duas abas:

1. **Geral** — vazia por enquanto (placeholder).
2. **Configurar Alertas** — um cartão por situação, todas configuráveis e disparadas por este módulo:

| Situação | Modo padrão |
|---|---|
| Cliente parou de responder (recuperação) | Assumir |
| Qualificado | Assumir |
| Desqualificado | Notificar |
| Contrato em curso | Assumir |
| Contrato assinado | Assumir |
| Fim de fluxo sem destino (erro) | Notificar |

Cada cartão tem:
- liga/desliga;
- modo: **Notificar** (Julia continua ativa) ou **Assumir** (Julia é pausada naquele contato);
- **vários números de WhatsApp por notificação** — lista com adicionar/remover, máscara BR, validação de duplicados; a mensagem é enviada para todos os números da lista, com registro individual por destinatário;
- editor da mensagem padrão com variáveis clicáveis:

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

Para Qualificado/Desqualificado o cartão inclui a escolha de quais etapas do CRM representam cada situação.

## Disparo dos gatilhos

- **Parou de responder**: entrada de pré-followup/followup para a sessão do lead.
- **Qualificado / Desqualificado**: mudança de etapa do lead no CRM da Julia, conforme etapas escolhidas na tela.
- **Contrato em curso / Contrato assinado**: geração e assinatura do contrato do lead — detecção própria do módulo, sem depender da configuração de Notificações de Contrato.
- **Fim de fluxo sem destino**: sessão que encerra sem etapa/destino definido.
- Envio pelo canal do próprio agente (credenciais em `agents` + adaptador de mensagens já existente), com histórico e anti-duplicidade (um disparo por lead por gatilho, resetado quando o lead volta a interagir).
- No modo **Assumir**, a Julia é pausada naquele contato pelo controle de sessão existente.

## Detalhes técnicos

- Tabelas novas:
  - `alert_notification_configs` — `cod_agent`, `trigger_key`, `is_active`, `mode` (`notify` | `takeover`), `recipients jsonb` (lista de números), `message_template`, `stage_ids jsonb`, timestamps + trigger de `updated_at`; RLS + GRANTs no padrão do projeto.
  - `alert_notification_logs` — `config_id`, `trigger_key`, `cod_agent`, `lead_phone`, `lead_name`, `recipient_phone`, `message_text`, `status`, `error_message`, `sent_at`; usada para deduplicação e histórico (uma linha por destinatário).
- Edge function `alert-notifications-cron` — consulta o Postgres legado (`followup_queue`/`followup_queue_temp`, `crm_atendimento_cards` + `crm_atendimento_stages`, `sessions`, `log_messages` para o resumo, contratos), monta a mensagem, envia para todos os números e grava logs; agendada por `pg_cron` a cada 2 minutos.
- Nenhuma alteração no módulo/funções de Notificações de Contrato existentes.
