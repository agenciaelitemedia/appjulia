# Alerta "Contrato em curso" não dispara: janela de 10 minutos comparada em fusos diferentes

## Diagnóstico (confirmado por consultas)

O alerta de contrato **nunca disparou** — a tabela `alert_notification_logs` não tem nenhuma linha com `trigger_key` `contract_in_progress` ou `contract_signed` (só `no_response`, `qualified` e `disqualified`).

O cron está saudável: `alert-notifications-every-2min` rodou com sucesso nas últimas execuções (12:02 → 12:10 UTC), e as configurações dos dois gatilhos de contrato estão ativas com destinatário preenchido.

A causa está na comparação de datas dos contratos do fluxo legado:

- A consulta filtra `sing_document.created_at >= NOW() - INTERVAL '10 minutes'`.
- No banco legado, `NOW()` retorna **UTC** (`12:12`), mas `created_at` dos contratos é gravado em **hora de Brasília** (`09:03` para o contrato gerado hoje pouco antes).
- Resultado: todo contrato aparece "3 horas no passado" e nunca cai na janela de 10 minutos. Conferido: contratos na última hora = 0 pela janela, mas o contrato real de hoje existe (`Ariane da Costa Moraes`, agente 202603001, 09:03 BRT).

O mesmo desvio afeta `qualified` / `disqualified`, que comparam `COALESCE(stage_entered_at, updated_at)` (também BRT) com `NOW()` (UTC) — esses só disparam quando a data foi gravada por um caminho que usa UTC, o que explica o comportamento intermitente.

Os contratos do X-Julia (`xj_contracts`) não têm esse problema (timestamps em UTC), mas também não houve contrato novo lá desde 10/ago.

## O que vai ser corrigido

1. **Janela de tempo consciente do fuso** em `alert-notifications-cron`:
   - Passar a comparar contra o "agora" em Brasília (`NOW() AT TIME ZONE 'America/Sao_Paulo'`) para as colunas legadas, mantendo tolerância para linhas que eventualmente estejam em UTC (aceita a linha se ela cair na janela em qualquer um dos dois fusos).
   - Aplicar em `contract_in_progress`, `contract_signed`, `qualified`, `disqualified` e `flow_error`.
2. **Recuperar o contrato de hoje**: com a correção, a próxima rodada do cron enxerga contratos recentes; a anti-duplicidade por `cod_document + status` continua, então nada é reenviado depois.
3. Sem mudança de schema, sem mexer no módulo antigo de Notificações de Contrato e sem alterar a tela.

## Detalhes técnicos

- Arquivo: `supabase/functions/alert-notifications-cron/index.ts`, função `fetchCandidates`.
- Introduzir uma expressão SQL única reutilizada nos gatilhos:
  `ts >= LEAST(NOW(), NOW() AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '10 minutes'`
  aplicada a `d.created_at` (contratos), `COALESCE(c.stage_entered_at, c.updated_at)` (CRM) e `s.stoped_at` (flow_error, mantendo a janela de 1 dia).
- Manter `RECENT_WINDOW_MS` como fonte única do tamanho da janela (10 min) para não divergir do `no_response`.
- Redeploy da função `alert-notifications-cron`; validar na rodada seguinte pelos logs da função e por uma nova linha em `alert_notification_logs` / card em `alert_crm_cards`.
