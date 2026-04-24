

## Diagnóstico: por que não chega sincronização de mensagens

Verifiquei o estado real do sistema:

| Item | Estado |
|---|---|
| Instância UaZapi `QUEUE_2_7e6e8e16` (cliente 30) | ✅ `connected` (Mário Castro) |
| Webhook registrado na UaZapi | ✅ ativo, URL correta, eventos `messages`, `messages.set`, `history`, etc. |
| Tabelas `uazapi_history_runs` / `uazapi_history_items` | ⚪ **0 linhas** (vazias após o reset) |
| Logs do webhook (últimos 30 min) | Apenas **1 evento `messages`** com 1 mensagem de **grupo** → filtrada (`skipped.group=1, processed=0`) |
| Eventos `history` / `messages.set` | ❌ **Nenhum recebido** desde o reset |

### Causa raiz

A UaZapi **só dispara o burst de histórico (`messages:replay` / `history`) quando a instância (re)conecta após estar desconectada**. Como você fez **reset → reconexão imediata** (sem desconectar de fato), o servidor UaZapi entendeu que era uma sessão ativa contínua e **não reenviou o histórico** — apenas começou a entregar mensagens novas em tempo real (e a única que chegou foi de grupo, que é descartada por design).

Não é bug do nosso código: o pipeline (webhook → fila → resume worker) está saudável, só não há nada para processar porque a UaZapi não está mandando histórico.

Adicionalmente identifiquei que o webhook atual ainda chama `dispatchHistoryProcessor` (fan-out em paralelo) — o que volta a saturar o EdgeRuntime quando o burst chegar de novo. A migração anterior preparou o `payload` por item e o cron `uazapi-history-resume`, mas o webhook nunca foi atualizado para parar de invocar o processor.

## Correções

### 1. Forçar a UaZapi a reenviar o histórico
Botão **"Forçar resync de histórico"** na aba Histórico UaZapi que:
- Chama `POST /instance/disconnect` (mantém pareamento, só derruba sessão WS)
- Aguarda 2s
- Chama `POST /instance/connect` para religar
- Resultado: a UaZapi entende que houve reconexão real e dispara `messages:replay` / `history` novamente

Alternativa de backup: chamar diretamente `POST /chat/find` + `POST /message/find` para os contatos existentes (já temos o backfill on-demand, mas ele só dispara quando uma mensagem nova chega).

### 2. Remover dispatch paralelo do webhook (limpar dívida)
Em `uazapi-chat-webhook` → `enqueueHistoryRun`:
- **Remover** a chamada a `dispatchHistoryProcessor` ao final
- O webhook só enfileira (já persiste `payload` por item) e responde 200
- O cron `uazapi-history-resume` (a cada 1 min, lote 5) drena com segurança

### 3. Banner explicativo na aba Histórico UaZapi
Quando `uazapi_history_runs` estiver vazia mas a instância estiver conectada, mostrar:
> "Nenhum histórico recebido. A UaZapi só envia histórico ao reconectar. Use **Forçar resync de histórico** para solicitar o reenvio."

## Arquivos afetados
- `supabase/functions/uazapi-chat-webhook/index.ts` (remover `dispatchHistoryProcessor`)
- `supabase/functions/uazapi-history-force-resync/index.ts` (novo — disconnect + reconnect na UaZapi)
- `src/pages/configuracoes/components/UazapiHistoryTab.tsx` (botão "Forçar resync" + banner explicativo)

## Resultado esperado
- Clicar em **"Forçar resync de histórico"** força a UaZapi a reenviar o burst de `messages:replay`
- O webhook enfileira tudo em `uazapi_history_items` (com `payload`), responde 200 imediato
- O cron `uazapi-history-resume` drena os items em lotes de 5/min sem saturar o EdgeRuntime
- A aba mostra a contagem viva de pendências diminuindo até zerar
- Nunca mais haverá fan-out paralelo do webhook → o sistema fica resiliente independente do tamanho da rajada

