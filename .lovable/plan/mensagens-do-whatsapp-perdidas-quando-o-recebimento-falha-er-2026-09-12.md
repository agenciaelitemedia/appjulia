# Mensagens do WhatsApp perdidas quando o recebimento falha (erro 502)

## O que confirmei

O recebimento de mensagens do WhatsApp roda tudo dentro de uma única função muito grande (cerca de 2.000 linhas). Além de responder ao provedor, ela ainda dispara vários trabalhos pesados em segundo plano: transcrição de áudio, automações de fluxo, fila do X-Julia e reenvio para o n8n com tentativas repetidas. Quando esse conjunto estoura o limite de tempo/memória, o processo é encerrado à força: o provedor recebe erro, a mensagem pode se perder e, na repetição, pode duplicar.

Os mesmos erros aparecem nas funções de automação e de envio de webhooks, que são chamadas por esse mesmo caminho.

## O que será feito

1. **Registrar antes de processar**: assim que a mensagem chega, ela é gravada numa fila de recebimento e o provedor recebe sucesso imediato. Nada mais é feito na mesma chamada.
2. **Processar em etapas separadas**: um processador próprio consome a fila e faz o trabalho pesado (gravar conversa/mensagem, transcrição, automações, envio ao n8n) em execuções curtas e independentes, uma mensagem por vez.
3. **Sem trabalho pendurado após a resposta**: os disparos em segundo plano da função de recebimento saem; cada tarefa passa a ser um item de fila com tentativas controladas.
4. **Repetições seguras**: cada mensagem é identificada de forma única, então uma reentrega do provedor não cria mensagem duplicada.
5. **Visibilidade**: itens que falharem em todas as tentativas ficam marcados na fila com o motivo, para reprocessamento manual.

## Detalhes técnicos

- Nova tabela `chat_inbound_queue` (payload bruto, provider, `dedupe_key` único, status, tentativas, erro) com GRANTs e RLS.
- `uazapi-chat-webhook`: reduzir a apenas validar assinatura, montar `dedupe_key` e inserir na fila; remover os `EdgeRuntime.waitUntil` (transcrição, flow engine, x-julia, fan-out n8n).
- Nova função `chat-inbound-worker`: processa lotes pequenos (5–10 itens), reaproveitando as rotinas atuais extraídas para `_shared/`; agendada por `pg_cron` a cada minuto, além de disparo imediato pós-inserção.
- Fan-out para n8n e webhooks vira item de fila próprio, com backoff, em vez de tentativas dentro da requisição do provedor.
- Verificação: build + typecheck, publicar funções, enviar mensagem real de teste e conferir logs e a fila sem itens travados.

Risco: mexe no caminho crítico de recebimento; a implementação será incremental, mantendo a gravação atual funcionando até o processador estar validado.
