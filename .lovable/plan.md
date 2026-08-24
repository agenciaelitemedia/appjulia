# Devolução automática para a fila: por que o lead 5533998227896 voltou 1 minuto após a transferência

## O que aconteceu (confirmado nos dados)

Conversa `eb8dd3fd…` (cliente 294, fila 09d67a3d…):

```text
22/08 15:08 BRT  conversa aberta pelo webhook (última mensagem do cliente)
24/08 10:28 BRT  Dra. Nicole atribuiu para Dra. Kátia   (history: assigned)
24/08 10:29 BRT  Sistema devolveu para a fila           (history: auto_returned)
```

A regra usada é o **NRT** (tempo para responder a última mensagem do cliente), configurado em 1440 min, com tolerância de 15 min (`return_chat_tolerance_minutes` = 15, `return_chat_enabled` = true nas configurações do cliente).

O ponto central: a função `get_return_chat_candidates` mede o prazo **exclusivamente a partir de `last_customer_message_at`** — neste caso 22/08 15:08. Esse prazo (1440+15 min) já havia vencido em 23/08 15:23, ou seja, **quase 19 horas antes da transferência**. A conversa só não era candidata porque não tinha responsável (`assigned_to IS NULL`). No instante em que a Dra. Kátia foi atribuída, a conversa passou a satisfazer todos os critérios e o cron do minuto seguinte a devolveu.

Não é um bug de cálculo de horário/fuso: é o **âncora de tempo errada**. A transferência/atribuição não reinicia o relógio do NRT.

## Correção proposta

Ancorar o prazo na **mais recente** entre a última mensagem do cliente e o momento em que o atendimento passou a ter responsável. Assim, um atendente recém-atribuído sempre recebe o prazo completo (NRT + tolerância) para responder.

1. **Registrar o momento da atribuição**
   - Nova coluna `assigned_at` em `chat_conversations`, preenchida automaticamente por trigger sempre que `assigned_to` muda de nulo/vazio para um responsável (ou troca de responsável).
   - Backfill inicial a partir do último registro `assigned`/`transferred` em `chat_conversation_history`.

2. **Ajustar a regra de elegibilidade**
   - Em `get_return_chat_candidates`, trocar `c.last_customer_message_at` por
     `GREATEST(c.last_customer_message_at, COALESCE(c.assigned_at, c.last_customer_message_at))`
     tanto no cálculo do vencimento quanto na checagem de `auto_returned` anterior e na ordenação.
   - Manter todos os outros critérios inalterados (status open/pending, responsável presente, última mensagem do cliente, cliente com a devolução habilitada).

3. **Deixar a mensagem interna mais clara**
   - Na nota gerada pelo `chat-return-chat`, informar desde quando o prazo foi contado (ex.: "sem resposta desde 24/08 10:28"), evitando a impressão de devolução instantânea.

## Detalhes técnicos

- Migração: `ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS assigned_at timestamptz;` + trigger `BEFORE UPDATE OF assigned_to` (e `BEFORE INSERT` quando já vem com responsável) + backfill via `chat_conversation_history`.
- `get_return_chat_candidates` recriada com `CREATE OR REPLACE` mantendo assinatura, `STABLE SECURITY DEFINER` e `search_path = public`.
- A devolução automática limpa `assigned_to`; `assigned_at` permanece com o valor antigo, mas deixa de ser usado enquanto não houver responsável, e é reescrito na próxima atribuição.
- Nenhuma mudança no cron nem no frontend do chat; a Edge Function `chat-return-chat` muda apenas o texto da nota interna.
