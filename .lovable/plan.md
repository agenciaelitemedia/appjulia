# Auditoria de webhook das conexões + restaurar histórico da "Suporte" (escritório 30)

## O que já foi verificado

- A conexão indicada (`fae7eeca…`, "Suporte", escritório 30) **não registrou nenhum evento recebido do WhatsApp** e a última mensagem gravada nela é de **10/09 às 14:15**.
- Nenhuma importação de histórico do escritório 30 desde 15/06.
- Outras conexões do mesmo escritório receberam eventos hoje, então o recebimento em geral funciona — o problema é específico dessa conexão.
- A fila interna de processamento está saudável (poucos itens, de minutos atrás).
- Existem **52 conexões WhatsApp (QR Code) ativas** e 4 da API Oficial no sistema. Cerca de 25 conexões QR não receberam nenhum evento nas últimas 24h — pode ser apenas silêncio de movimento ou webhook desconfigurado; só a consulta ao provedor distingue os dois casos.

Diagnóstico da Suporte: o WhatsApp não está avisando o sistema (endereço de retorno/tipos de aviso desconfigurados no provedor). Sem esse aviso, a restauração do histórico nem é iniciada — hoje ela só começa quando o provedor avisa espontaneamente, não existe pedido ativo nem botão manual.

## O que será feito

1. **Auditoria de todas as conexões ativas (não excluídas)**: para cada conexão WhatsApp por QR Code, consultar no provedor o endereço de retorno configurado e os tipos de aviso ativos.
2. **Relatório**: uma tela/aba listando, por escritório e conexão: endereço de retorno correto (sim/não), avisos que faltam (mensagens, status, conversas, contatos, grupos, chamadas, histórico), se está ligada e a data do último evento recebido. As conexões com problema aparecem destacadas no topo, com resumo do total a corrigir.
3. **Correção em 1 clique**: botão por conexão e "Corrigir todas", reaplicando o endereço e a lista completa de avisos; depois a auditoria é reexecutada para confirmar.
4. **Corrigir a conexão Suporte** e validar com uma mensagem de teste.
5. **Pedir o histórico ativamente**: solicitar o histórico ao provedor quando o número terminar de conectar, em vez de apenas esperar o aviso, e disponibilizar um botão **"Restaurar histórico"** por conexão, com indicação de progresso.
6. **Rodar a restauração da Suporte** e acompanhar até concluir.

Nada existente será apagado: a importação só acrescenta o que falta e ignora mensagens repetidas.

## Detalhes técnicos

- Diagnóstico feito em `chat_inbound_queue` (zero eventos para o `queue_id`), `chat_messages` (última em 10/09), `uazapi_history_runs` e `queues` (52 uazapi + 4 waba ativas). `chat_inbound_queue` guarda apenas ~1 dia, por isso "sem eventos" não é conclusivo isoladamente.
- Auditoria: nova action `audit_webhooks` em `uazapi-instance-manager`, que para cada fila uazapi ativa faz `GET /webhook` com o token da instância e compara `url` (deve ser `…/functions/v1/uazapi-chat-webhook?queue_id=<id>`), `enabled` e `events` contra `DEFAULT_WEBHOOK_EVENTS` (que já inclui `history`). Retorna por fila: `url_ok`, `enabled`, `missing_events[]`, `extra_events[]`, `error`.
- Correção: reutilizar `reconfigure_webhook` (por fila) e `reconfigure_webhook_all`; sem duplicar lógica.
- Relatório na área de configurações (nova aba ao lado de `UazapiHistoryTab.tsx` / `QueueMaintenanceTab.tsx`), com `last_event` vindo de `chat_inbound_queue` e status de conexão do provedor.
- Histórico: nova action `request_history` que dispara a busca no provedor e entra no pipeline existente `enqueueHistoryRun` → `uazapi_history_items` → `uazapi-history-resume`/`uazapi-history-processor`, preservando dedupe.
- Sem mudança de schema.
