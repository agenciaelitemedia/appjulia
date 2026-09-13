# Diagnóstico: o histórico da fila está rodando?

## Resposta curta

O motor do histórico está vivo, mas **não recebe nada novo desde 11/09 às 18:10 (horário de São Paulo)**. E existe um problema maior por trás: a **fila de entrada do WhatsApp travou hoje às 01:25 (SP)** e está acumulando eventos sem processar — enquanto isso não for resolvido, nenhum novo histórico será processado também.

## O que os dados mostram

Motor do histórico (o que a aba "History UaZapi" exibe):
- Batimento do processador: ativo, atualizado neste minuto, 0 itens na espera.
- Último lote recebido: 11/09 18:10 (SP). Desde então, zero lotes novos.
- 12.567 lotes concluídos/parciais no total; **438 lotes ficaram "em execução"/"aguardando" para sempre** (o mais antigo de 25/04), sem nunca terminar nem dar erro.

Fila de recebimento do WhatsApp (todos os eventos, inclusive histórico):
- 31.583 eventos aguardando, o mais antigo de hoje 01:09 (SP).
- Entradas continuam normais (~16 mil por hora), mas **processados por hora caiu para zero** depois das 01:25.
- 598 eventos ficam presos "processando" e voltam para a fila.
- Os erros finais são todos o mesmo: o reprocessamento interno estoura o limite de 150 segundos (tempo esgotado) e às vezes retorna erro de gateway.
- A maior parte do acúmulo é ruído: 18.749 atualizações de lista de conversas e 12.213 atualizações de status de mensagem — coisas que quase não precisam de trabalho, mas ocupam toda a capacidade.

Conclusão: o histórico "não está executando" porque (a) a operadora não enviou lotes novos desde 11/09 — isso só acontece em reconexão ou resync forçado — e (b) se enviasse agora, o evento entraria na fila travada e ficaria parado.

## O que corrigir

1. **Destravar a fila de entrada** (prioridade máxima)
   - Deixar de gastar o processamento com eventos que não geram mensagem: atualizações de lista de conversas, atualizações de status, grupos e presença passam a ser resolvidas de forma direta e leve, sem reprocessar o fluxo completo.
   - Aumentar o volume por rodada e limitar o tempo de cada item, para um item lento não travar o lote inteiro.
   - Criar uma execução automática por minuto do processador da fila (hoje ele só é acionado quando chega evento novo — se a rodada falha, ninguém retoma).
   - Drenar o acúmulo atual e reprocessar os 69 eventos que desistiram.

2. **Fechar os lotes de histórico presos**
   - Marcar como encerrados por tempo esgotado os 438 lotes parados há horas/dias, para os painéis mostrarem a situação real.
   - Passar a encerrar automaticamente lotes sem progresso após um tempo definido.

3. **Deixar visível na tela de Configurações**
   - Na aba do histórico, mostrar um aviso quando não houver lote novo há muito tempo e quando a fila de entrada estiver acumulando, com o número de itens parados.

## Detalhes técnicos

- Diagnóstico vem de `dispatcher_heartbeat`, `uazapi_history_runs`, `uazapi_history_items` e `chat_inbound_queue` (contagens por status, por hora e por `event_name`).
- Gargalo: `src/routes/api/public/chat-inbound-worker.ts` usa lote de 5 e reinvoca `uazapi-chat-webhook` por item; o webhook excede 150s e devolve `IDLE_TIMEOUT`, então o item volta a `pending` com backoff — vazão efetiva zero.
- Mudanças previstas: fast-path por `event_name` no worker/webhook para `chats`, `messages_update`, `groups`, `presence`; `BATCH_SIZE` maior com `AbortController` por item; novo `cron.schedule` de 1 minuto chamando o endpoint do worker com `CHAT_INBOUND_WORKER_SECRET`; SQL de encerramento dos runs órfãos (`status in ('running','pending')` e `updated_at < now() - interval '2 hours'` → `partial`/`error`); indicadores novos em `UazapiHistoryTab.tsx`.
- Sem alteração no formato do payload da UaZapi nem na gravação de mensagens reais.
