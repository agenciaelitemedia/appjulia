# Recuperar mensagens que ficaram como "Aguardando esta mensagem"

## O que acontece hoje

Quando o WhatsApp entrega a mensagem sem conseguir decifrar o conteúdo, o chat grava um aviso fixo ("Aguardando esta mensagem. Isso pode demorar um pouco.") e nunca mais tenta buscar o conteúdo real. Se o conteúdo verdadeiro aparecer depois no provedor de WhatsApp, ele não chega ao chat.

Sim: em boa parte dos casos o conteúdo real fica disponível no provedor minutos depois. Então vale tentar de novo.

## O que será feito

1. **Nova tentativa automática**
   Cada mensagem que cair nesse estado passa a ser marcada como "pendente de recuperação". Uma rotina roda a cada 5 minutos e tenta buscar o conteúdo real no provedor para essas mensagens (das últimas 24 horas). Até 8 tentativas por mensagem, com intervalos crescentes; depois disso a mensagem é encerrada como não recuperável.

2. **Atualização quando o conteúdo chegar**
   Se o provedor devolver o texto (ou a mídia) verdadeiro, a mensagem existente é atualizada no lugar — mesmo balão, mesma hora, sem duplicar — e a prévia da conversa na lista também é corrigida.

3. **Botão "Tentar novamente"**
   No próprio balão do aviso aparece um botão discreto para forçar a busca na hora, com retorno imediato ("recuperada" ou "ainda não disponível").

4. **Quando o provedor reenvia sozinho**
   Se o provedor mandar uma atualização dessa mensagem com o conteúdo, o chat passa a aceitar essa correção em vez de ignorar (hoje só aceita edições explícitas).

## Detalhes técnicos

- `chat_messages.metadata` ganha `undecryptable: { attempts, last_attempt_at, resolved, gave_up }` — sem mudança de schema.
- Nova Edge Function `uazapi-message-revalidate`:
  - modo `single` (por `message_id`, usado pelo botão) e modo `sweep` (varre pendentes das últimas 24h, lote limitado).
  - busca via `POST /message/find` no provedor da fila da conversa (mesmo padrão de `uazapi-chat-backfill`), reaproveitando a resolução de credenciais por `queue_id`.
  - se o retorno ainda for `[undecryptable]`/`error`, incrementa `attempts` e sai; se vier conteúdo, atualiza `text`, `type`, `media_url`/`file_name` e `chat_conversations.last_message_text`.
- Agendamento: `pg_cron` a cada 5 minutos chamando a função em modo `sweep`.
- `uazapi-chat-webhook` (`messages.update`): quando a linha atual tiver o texto de aguardo e o payload trouxer texto/mídia real, aplica a substituição (sem marcar como "editada").
- `MessageBubble.tsx`: no bloco do aviso âmbar (texto começando com `🕐`), adiciona botão "Tentar novamente" chamando a função em modo `single`, com estado de carregamento e toast de resultado.
