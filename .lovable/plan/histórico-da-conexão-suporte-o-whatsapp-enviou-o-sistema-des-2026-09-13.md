# Histórico da conexão "Suporte": o WhatsApp enviou, o sistema descartou

## O que os dados mostram (verificado agora)

- A conexão Suporte **passou a receber eventos** depois da correção do webhook: 79 eventos de conexão, 1 de status e **6 pacotes de histórico** (3 já processados às 14:58, 3 ainda na espera desde 15:04).
- Apesar disso, **nenhum lote de restauração foi criado hoje** — nem para essa conexão, nem para nenhuma outra do sistema. O último lote registrado dessa conexão é de 15/06.
- Nenhuma mensagem nova foi gravada nessa conexão: a mais recente continua sendo de **10/09 às 17:15**.
- Olhando o conteúdo real de um pacote de histórico: as conversas vêm identificadas apenas pelo **novo formato interno do WhatsApp (`@lid`)**, e o telefone verdadeiro aparece só num campo separado (`sender_pn`, ex.: 553488860163). A rotina que monta a restauração tenta ler o telefone do identificador da conversa, não encontra número válido nesse formato e **descarta a conversa inteira**.
- Existe ainda um segundo problema não confirmado: mesmo descartando tudo, deveria ter sido registrado um lote "vazio" — e não há registro nenhum. Ou seja, há uma falha adicional a diagnosticar no registro do lote.
- Em paralelo, a fila geral de recebimento está com **1.539 eventos na espera, 115 travados em processamento e 2.886 com falha**, o que atrasa até os pacotes de histórico que chegam corretamente.

## O que será feito

1. **Confirmar a segunda causa antes de mexer**: reprocessar um dos pacotes de histórico já recebidos com registro de log detalhado, para saber exatamente em que ponto o lote deixa de ser criado (descarte por telefone, erro ao gravar o lote, ou desvio antes disso).
2. **Passar a entender o novo formato do WhatsApp (`@lid`)**: a restauração deixará de depender do identificador da conversa e usará o telefone real informado no pacote (`sender_pn` / `sender_lid` / `chatlid`), com as variantes brasileiras de 12 e 13 dígitos, do mesmo jeito que o chat já faz para mensagens novas. Conversas de grupo continuam ignoradas.
3. **Nunca mais perder um pacote em silêncio**: quando um pacote de histórico chegar e nada puder ser aproveitado, o sistema registra o lote com o motivo do descarte, para aparecer na tela de histórico em vez de desaparecer.
4. **Desafogar a fila de recebimento**: destravar os itens presos, reprocessar os que falharam e drenar o acúmulo, para os pacotes de histórico serem processados em minutos.
5. **Rodar a restauração da Suporte** reaproveitando os pacotes já recebidos (sem precisar desconectar o número de novo) e acompanhar até concluir, confirmando que as conversas antigas aparecem no chat.
6. **Mostrar o resultado na tela**: na aba de histórico, indicar por conexão quando o último pacote foi recebido, quantas conversas foram aproveitadas e quantas descartadas com o motivo.

Nada é apagado: a restauração só acrescenta o que falta e ignora mensagens repetidas.

## Detalhes técnicos

- Diagnóstico: `chat_inbound_queue` (6 itens `event_name='history'` da fila `fae7eeca…`, 3 `done`, 3 `pending`), `uazapi_history_runs` (0 linhas hoje; última da fila em 15/06), `chat_messages` via `chat_conversations.queue_id` (máx. 10/09 17:15) e inspeção do payload (`EventType='history'`, `event='messages'`, 31 mensagens, `chatid`/`sender`/`chatlid` em `@lid`, telefone real só em `sender_pn`).
- Causa confirmada nº 1: em `enqueueHistoryRun` (`supabase/functions/uazapi-chat-webhook/index.ts`), o agrupamento usa `remoteJid = key.remoteJid ?? remoteJid ?? chatId ?? chatid` e depois `normalizePhone(remoteJid)`; com `@lid` o retorno é vazio e o `continue` descarta a mensagem, resultando em `byChat.size === 0`.
- Causa nº 2 (a confirmar no passo 1): ausência total de linha em `uazapi_history_runs` indica falha no `insert` do run (ou desvio antes do branch `event === 'history'`), já que o código insere run mesmo com `byChat.size === 0`. Só depois de confirmar por log é que a correção será escrita.
- Correção de resolução de telefone: extrair candidatos na ordem `sender_pn` → `sender` → `chatid`/`chatlid` (ignorando `@lid`) → `key.remoteJid`, normalizando com o helper compartilhado já usado na busca por telefone (variantes BR 12/13 dígitos); manter `isGroupMessage`/`@g.us` como descarte e incrementar `skipped_lid` apenas quando nenhum telefone for recuperável.
- Fila: liberar `status='processing'` com `locked_at` antigo, requeue de `failed` recentes com `attempts` zerado, e rodadas manuais do endpoint `/api/public/chat-inbound-worker` até drenar; sem mudança de contrato do worker.
- Reprocesso da Suporte: reenfileirar os 3 itens `done` de histórico (novo `dedupe_key`) para reaproveitar os pacotes já recebidos, evitando novo disconnect/reconnect via `uazapi-history-force-resync`.
- UI: acrescentar em `UazapiHistoryTab.tsx` as colunas/indicadores de último pacote recebido, aproveitados e descartados (`group_messages`, `duplicate_messages`, `skipped_lid`).
- Sem alteração de schema.
