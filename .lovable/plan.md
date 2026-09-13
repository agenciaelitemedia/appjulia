# Restauração do histórico ao conectar o número (escritório 30)

## O que os dados mostram agora

- A conexão feita há poucos minutos (13:49) está acontecendo na conexão **MRA**, e não na **Suporte**. A conexão Suporte não recebeu **nenhum** evento do WhatsApp nas últimas 12 horas.
- A MRA está com status **"conectando"**, gerando QR Code repetidamente — ou seja, o pareamento ainda não foi concluído.
- Nenhuma importação de histórico foi registrada para o escritório 30 desde 15/06 (1.216 concluídas antes disso).
- Nas últimas 3 horas não chegou **nenhum** evento de histórico de nenhum escritório — o provedor não está enviando esse tipo de evento.
- A fila de recebimento de mensagens está saudável (poucos itens, de minutos atrás), então não é atraso de fila.

Conclusão provável (a confirmar no passo 1): a importação nem começa porque o provedor não envia o evento de histórico para essa conexão — e hoje o sistema só importa quando esse evento chega espontaneamente. Não existe hoje um pedido explícito de histórico no momento da conexão nem um botão para pedir manualmente.

## O que será feito

1. **Confirmar a causa**: conferir quais eventos estão assinados na conexão do WhatsApp usada (MRA e Suporte) e reassinar a lista completa, incluindo o evento de histórico. Se o evento passar a chegar, a importação volta a iniciar sozinha.
2. **Pedir o histórico ativamente ao conectar**: quando o número terminar de conectar, o sistema solicita o histórico ao provedor em vez de apenas esperar. Assim a importação começa mesmo que o provedor não avise sozinho.
3. **Botão "Restaurar histórico"** na tela da conexão: permite disparar a importação a qualquer momento para uma conexão já conectada, com aviso de progresso.
4. **Aviso claro na tela** quando a conexão estiver apenas "conectando": hoje não há indicação de que o histórico só começa após o pareamento concluir.
5. **Validar de ponta a ponta**: concluir a conexão do número, acompanhar a importação aparecendo na tela de histórico e conferir que as conversas antigas apareceram no atendimento.

Nada de mensagens, contatos ou conversas existentes será apagado ou alterado — a importação só acrescenta o que falta e ignora duplicados.

## Detalhes técnicos

- Diagnóstico já feito com `chat_inbound_queue` (eventos por fila/cliente), `uazapi_history_runs` e `queues`.
- `uazapi-instance-manager` já inclui `history` em `DEFAULT_WEBHOOK_EVENTS`, porém as instâncias criadas antes dessa mudança podem estar sem a assinatura; usar `reconfigure_webhook` por fila (e `reconfigure_webhook_all` se necessário).
- A action `connect` hoje só chama `/instance/connect`. Acrescentar, no fluxo pós-conexão, uma nova action (ex.: `request_history`) que dispara a busca de histórico no provedor e cai no pipeline existente `enqueueHistoryRun` → `uazapi_history_items` → `uazapi-history-resume`/`processor`, sem duplicar lógica.
- Botão de UI em `src/pages/configuracoes/components/UazapiHistoryTab.tsx` (ou na tela da fila), reaproveitando o padrão de "resync" já existente.
- Sem mudança de schema; dedupe atual de mensagens já protege contra duplicidade.
