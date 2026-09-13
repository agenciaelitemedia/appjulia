# Restaurar o histórico da conexão "Suporte" (escritório 30)

## O que os dados mostram

- A conexão indicada (`fae7eeca…`, "Suporte", instância `QUEUE_2_0ea0fda8`) **não registrou nenhum evento recebido do WhatsApp** — nem mensagem, nem status de conexão, nem histórico.
- A última mensagem gravada nessa conexão é de **10/09 às 14:15**; depois disso, nada.
- Nenhuma importação de histórico do escritório 30 desde 15/06.
- Nas últimas horas os eventos que chegaram do escritório 30 são de outra conexão ("MRA"), o que mostra que o recebimento em geral está funcionando — o problema é específico da conexão Suporte.
- A fila interna de recebimento está saudável (poucos itens, de minutos atrás), então não é atraso de processamento.

Diagnóstico: o WhatsApp conectado nessa conexão não está avisando o sistema (o endereço de retorno / os tipos de aviso dessa instância estão desconfigurados no provedor). Sem esse aviso, a restauração do histórico nem é iniciada — e hoje ela só começa quando o provedor avisa espontaneamente, não existe pedido ativo nem botão manual.

## O que será feito

1. **Confirmar e corrigir a configuração da conexão Suporte**: verificar no provedor qual endereço de retorno e quais tipos de aviso estão ativos nessa instância e reconfigurá-los com a lista completa (incluindo histórico, mensagens, status e conversas).
2. **Validar o recebimento**: enviar/receber uma mensagem de teste nessa conexão e confirmar que ela chega ao atendimento.
3. **Pedir o histórico ativamente**: passar a solicitar o histórico ao provedor quando o número terminar de conectar, em vez de apenas esperar o aviso.
4. **Botão "Restaurar histórico"** por conexão, para disparar a importação a qualquer momento em um número já conectado, com indicação de progresso.
5. **Rodar a restauração agora** para a conexão Suporte e acompanhar na tela de histórico até concluir.

Nada existente será apagado: a importação só acrescenta o que falta e ignora mensagens repetidas.

## Detalhes técnicos

- Diagnóstico feito em `chat_inbound_queue` (zero eventos para esse `queue_id`), `chat_messages` (última em 10/09), `uazapi_history_runs` e `queues`.
- A fila não tem `webhook_token` definido, então a autenticação do webhook não é a causa da ausência de eventos.
- Usar `uazapi-instance-manager` action `reconfigure_webhook` para essa fila (a lista `DEFAULT_WEBHOOK_EVENTS` já inclui `history`); conferir também o retorno de `status` da instância para garantir que o número está realmente pareado nela.
- Acrescentar action `request_history` que dispara a busca de histórico no provedor e entra no pipeline existente `enqueueHistoryRun` → `uazapi_history_items` → `uazapi-history-resume`/`uazapi-history-processor`, sem duplicar lógica de dedupe.
- UI: botão na tela de filas (`QueueQRCodeDialog`/lista de filas) e/ou em `UazapiHistoryTab.tsx`, reaproveitando o padrão de "resync" existente.
- Sem mudança de schema.
