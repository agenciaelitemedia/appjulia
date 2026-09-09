# Campanha: reaproveitar o lead existente pelo número e mostrar o nome no card

## O problema confirmado

Na última campanha, o destinatário `5534988860163` foi enviado sem nome preenchido. O card criado ficou com título e nome de contato `5534988860163`, mesmo existindo no mesmo escritório um contato já conhecido como **Mário Castro** (gravado como `553488860163`, sem o 9).

Duas causas:

1. A busca do contato aceita as duas formas do número (com e sem o 9), mas sem ordem definida — pode pegar qualquer um dos registros duplicados.
2. Quando o contato é encontrado, o nome dele é ignorado: o card usa apenas o nome que veio na lista da campanha e, se estiver vazio, usa o telefone.

## O que muda

Ao criar o card pela campanha:

1. Busca o lead pelo número nas duas formas (com o 9 e sem o 9), sempre dentro do mesmo escritório, preferindo o registro idêntico ao número enviado e, entre vários, o mais recentemente atualizado.
2. Se achar, o card é vinculado a esse contato existente — nenhum contato novo é criado.
3. O nome exibido no card passa a ser, nesta ordem: nome do contato existente → nome enviado na lista da campanha → telefone. Isso vale para o título e para o nome de contato do card.
4. Se o contato existente estiver sem nome e a lista da campanha trouxer um, o contato é atualizado com esse nome (nunca sobrescreve nome já existente).
5. Card já ativo no painel escolhido: além de ser movido para a etapa da campanha, tem título/nome corrigidos quando hoje mostram apenas o número.

Regras atuais preservadas: nunca duplica contato no mesmo escritório; card arquivado/perdido/ganho não bloqueia a criação de um novo; erro no CRM não derruba o disparo.

## Detalhes técnicos

Arquivo único: `supabase/functions/_shared/dsp-crm-push.ts`.

- Busca de contato: `select id, name, phone` filtrando `client_id` + `in('phone', variants)`, `order('updated_at desc')`, escolha em memória priorizando `phone === phone` exato; tolerar `is_group` nulo (`.or('is_group.is.null,is_group.eq.false')`).
- `leadName` recalculado após a resolução do contato: `contact.name?.trim() || recipient.name?.trim() || phone`.
- `update` em `chat_contacts.name` apenas quando o nome atual é vazio/igual ao telefone e há nome vindo do destinatário.
- Caminho do card existente: incluir `title`/`contact_name` no patch quando o valor atual for só dígitos igual ao telefone.

Sem migração e sem alteração no envio, limites ou janela de disparo. Depois é só publicar o worker de campanhas.
