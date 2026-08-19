# Prévia vazia: o filtro por agente nunca casa

## O que a verificação mostrou

Consultei o banco:

- `chat_conversations` tem 57.003 linhas e **`cod_agent` é nulo em 100% delas** (nenhuma linha preenchida).
- Com os demais filtros da regra (última mensagem nossa, retorno do lead nas últimas 48h, conversa não encerrada) existem **712 conversas candidatas** — ou seja, há dados; só o filtro por agente elimina tudo.
- O vínculo com o agente existe em **`chat_contacts.cod_agent`** (585 contatos preenchidos, 3 agentes distintos). Pelo contato, 36 dessas 712 conversas pertencem ao agente `202607001` e 677 estão sem agente no contato.

Consequência: além da prévia aparecer vazia, o **disparo real também nunca ocorre** — a edge function `alert-notifications-cron` usa o mesmo `.eq("cod_agent", ...)` em `chat_conversations` (linha 164).

## Correção proposta

1. **Prévia (`useNoResponsePreview`)**: parar de filtrar por `chat_conversations.cod_agent`. Resolver o agente pelo contato:
   - buscar em `chat_contacts` os contatos com `cod_agent` = agente selecionado;
   - filtrar as conversas por `contact_id in (...)` mantendo os demais filtros iguais aos do disparo (última mensagem nossa, `last_customer_message_at` nos últimos 2 dias, status diferente de encerrada).
2. **Fallback por escritório**: quando o agente não tem contatos vinculados, considerar as conversas do mesmo escritório (`client_id` do agente) cujo contato não tem outro agente — evitando a prévia vazia nos 677 casos sem `cod_agent` no contato. A prévia indica na nota qual critério foi usado.
3. **Disparo real (`alert-notifications-cron`)**: aplicar exatamente a mesma resolução de agente, para que prévia e disparo continuem idênticos. Sem isso o alerta `no_response` segue sem nunca disparar.
4. Ajustar os textos de estado vazio para refletirem o critério real ("nenhuma conversa em silêncio nas últimas 48h para este agente/escritório").

## Detalhes técnicos

- Nenhuma mudança de schema. Todo acesso continua via `extend/db.ts`.
- Passo extra de query: `chat_contacts` por `cod_agent` (limite ~500 ids) antes de consultar `chat_conversations` com `.in('contact_id', ids)`.
- Escritório do agente resolvido pelo caminho já usado no módulo (agentes/`client_id`), sem tocar em auth.
- Redeploy de `alert-notifications-cron` após o ajuste.
