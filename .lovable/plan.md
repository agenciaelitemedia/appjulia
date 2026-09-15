# Recebimento de mensagens x envio para a automação (n8n)

## O que eu verifiquei agora

**Recebimento está saudável.** A fila de entrada do WhatsApp está fluindo: 4.376 eventos processados hoje, apenas 7 em processamento no momento, nenhum pendente acumulado e nenhum item marcado como falho. Nas últimas 3 horas entraram 2.857 eventos (1.502 só na última hora) e todos foram gravados.

**O problema está no envio para a automação.** Nas últimas 24h houve **391 envios ao n8n que falharam definitivamente**, sendo 342 só na última hora. Os motivos são todos do lado do servidor da automação:

- 282 respostas "serviço indisponível" (503)
- 98 respostas de erro interno (500)
- 10 respostas de gateway (502)
- alguns casos de conexão recusada e 2 estouros de tempo (30s)

Cada envio já tenta 3 vezes com espera crescente antes de desistir.

**Agravante encontrado:** quando as 3 tentativas falham, o evento é gravado numa tabela de registro e **nunca mais é reenviado**. Hoje existem 400 registros nesse estado — ou seja, essas mensagens de clientes chegaram no chat mas nunca foram vistas pela automação da Julia. É exatamente esse o efeito de "a Julia não respondeu".

## Causa

O servidor da automação (webhook.atendejulia.com.br) está sobrecarregado/instável e recusando as chamadas. O sistema aqui está funcionando, mas descarta o que não conseguiu entregar.

## O que será feito

1. **Reenvio automático do que falhou** — criar um processo agendado (a cada poucos minutos) que pega os envios marcados como falhos e tenta entregar de novo, com espera crescente e limite de tentativas ao longo de algumas horas. Assim uma instabilidade momentânea da automação deixa de virar mensagem perdida.
2. **Mais tolerância na hora do envio** — aumentar as tentativas imediatas e a espera entre elas para os erros típicos de sobrecarga (500/502/503 e estouro de tempo), sem prender o recebimento.
3. **Reprocessar agora os 400 eventos pendentes** — reenviar o backlog acumulado para a automação, em lotes, evitando derrubar o servidor de novo.
4. **Visibilidade** — mostrar no painel de saúde já existente quantos envios estão falhando/aguardando reenvio e o último erro, para o problema não ficar invisível.
5. **Alerta de instabilidade** — quando a taxa de falha de envio passar de um limite, registrar aviso claro em vez de só logar.

Fica fora deste plano corrigir o servidor da automação em si (é infraestrutura externa ao app); o objetivo aqui é não perder mensagem quando ele oscilar.

## Detalhes técnicos

- Origem: `supabase/functions/uazapi-chat-webhook/index.ts`, bloco `[fan-out]` (linhas ~1454-1516). Dead-letter em `webhook_queue` com `message_type='uazapi_fanout'`, `status='failed'`, `error_message='n8n fan-out failed: ...'`.
- Novo worker: rota `src/routes/api/public/n8n-fanout-retry.ts` (autenticada por segredo interno, mesmo padrão do `chat-inbound-worker`), lotes pequenos + concorrência baixa, incrementando `retries` e atualizando `error_message`/`n8n_response_status`; sucesso vira `status='sent'` com `sent_at`.
- Agendamento por `pg_cron` a cada 3 minutos; itens com `retries >= limite` ficam como `failed` definitivo para inspeção.
- Ajuste de `N8N_MAX_ATTEMPTS`/backoff no fan-out; manter `EdgeRuntime.waitUntil` para não bloquear a resposta ao provedor.
- Payload do reenvio: reutilizar `payload` + `cod_agent` já persistidos, preservando a query `?app=uazapi&c=<cod_agent>`.
- Verificação: typecheck + build, publicar, conferir queda de `status='failed'` e chegada dos eventos no n8n.
