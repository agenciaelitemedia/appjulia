# Limpar notificações e cards do CRM de Notificações

## O que existe hoje

- 542 registros de histórico de alertas enviados
- 233 cards no CRM de Notificações
- 2 ações de recuperação registradas nos cards

## O que será feito

Apagar todos esses registros, deixando o módulo zerado:

1. Remover as ações de recuperação dos cards
2. Remover todos os cards do CRM de Notificações
3. Remover todo o histórico de alertas enviados

Efeito prático: o CRM fica vazio e o histórico limpo. Como o disparo é decidido pelo card, os leads que ainda estiverem elegíveis voltarão a gerar card e notificação no próximo ciclo do cron.

## Detalhes técnicos

Operação de dados (sem mudança de schema), na ordem: `alert_crm_card_actions` → `alert_crm_cards` → `alert_notification_logs`.
