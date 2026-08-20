# Por que "Lead parado" nunca notificou

## Diagnóstico (verificado no banco e no código)

O cron roda normalmente (`alert-notifications-every-2min`, ativo). O problema não é o agendamento — são três bloqueios em série:

1. **Configuração desligada no agente principal.** Em `alert_notification_configs`, o gatilho `no_response` do agente 202603001 está com `is_active = false` (todos os outros gatilhos desse agente estão ativos — e é por isso que só existem logs de `qualified` e `disqualified`).
2. **Único `no_response` ativo está sem destinatário.** O agente 202606002 tem `no_response` ativo, porém `recipients = []`. Sem número, nada é enviado.
3. **Bug de truncamento na busca da última mensagem.** Em `fetchNoResponseCandidates`, o código carrega até 200 conversas e depois busca as mensagens dessas conversas com `order by timestamp desc limit 500` numa única query global. Como o gatilho procura conversas cuja última mensagem é *antiga* (>= 30 min), essas mensagens ficam fora das 500 mais recentes (dominadas pelas conversas ativas). Resultado: a última mensagem da conversa candidata não é encontrada, o candidato é descartado no `if (!lastMessage?.from_me) continue` e a lista sai vazia. Ou seja: mesmo com a config ligada e destinatário preenchido, o gatilho praticamente nunca produziria candidatos.

Observação adicional: a janela é estreita por regra (X a X+10 min) e o cron roda a cada 2 min, então isso está coerente — não é a causa.

## Correção proposta

### 1. Corrigir a seleção de candidatos (código)
Em `supabase/functions/alert-notifications-cron/index.ts`, reescrever `fetchNoResponseCandidates`:
- Deixar de depender de uma query global de mensagens truncada. Filtrar as conversas já no banco pela janela alvo, usando o campo de última mensagem da própria conversa (`last_message_at`/`updated_at`) com `gte`/`lte` correspondentes a `[now - (minutes+10min), now - minutes]`, mantendo `last_message_from_me = true` e status `pending`/`open`.
- Só depois, para o conjunto pequeno resultante, confirmar a última mensagem real (ignorando notas internas) consultando `chat_messages` por conversa (ou com `limit` proporcional e query por conversa), evitando o corte de 500 linhas.
- Manter as demais regras intactas (dedupe por telefone, resolução de sessão da Julia, `shouldSend` via card do CRM).

### 2. Ajustar as configurações (dados/UI)
- Reativar `no_response` para o agente 202603001 e preencher `recipients` do agente 202606002 — isso é feito pela própria tela **Notificações e Alertas** (não é mudança de código). Posso também ligar/preencher via banco, se você preferir.

### 3. Validar
- Rodar a função manualmente e conferir nos logs quantos candidatos foram encontrados por gatilho.
- Confirmar criação de card no CRM de Notificações + 1 envio único (sem duplicar) para um lead na janela.

## Detalhes técnicos
Arquivo alterado: `supabase/functions/alert-notifications-cron/index.ts` (apenas `fetchNoResponseCandidates`). Nenhuma mudança de schema. Sem impacto nos gatilhos de qualificado/desqualificado/contratos.
