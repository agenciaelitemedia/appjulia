# Prévia no cartão "Cliente parou de responder"

Mostrar, dentro do cartão do gatilho, uma prévia ao vivo de **quando cada lead será considerado sem resposta** e **qual foi a última mensagem considerada** — usando exatamente a mesma regra do disparo real (silêncio em minutos), para que o usuário valide o valor configurado antes de salvar.

## O que aparece na tela

Bloco novo dentro do cartão do gatilho `no_response`, abaixo do campo "Minutos sem resposta do lead":

- Linha de resumo: "Com 30 min, N conversas já elegíveis e M vão vencer nas próximas horas".
- Lista (até 8 itens, ordenada pelo vencimento mais próximo), cada item com:
  - nome do lead + WhatsApp mascarado;
  - **Última mensagem considerada**: prévia do texto (mesmo formatador usado nas listas de conversa), quem enviou (Lead / Julia) e horário;
  - **Vence em**: horário calculado (`última mensagem do lead + minutos`) e contagem relativa ("dispara em 12 min" / "já elegível há 40 min");
  - badge de estado: `Já elegível` (âmbar) ou `Aguardando` (neutro).
- A prévia recalcula ao mexer no campo de minutos (debounce), sem precisar salvar.
- Estados vazio ("Nenhuma conversa em silêncio nas últimas 48h"), carregando e erro.
- Nota explicando que a prévia usa a janela máxima de 2 dias e ignora conversas encerradas — igual ao disparo.

## Detalhes técnicos

- Novo hook `hooks/useNoResponsePreview.ts` (React Query, `staleTime` 30s), recebendo `codAgent` + `minutes`:
  - `chat_conversations` filtrando `cod_agent`, `last_message_from_me = true`, `last_customer_message_at` não nulo e dentro dos últimos 2 dias, `status <> 'closed'`, ordenado por `last_customer_message_at` desc, limite 50 — mesmos filtros do `alert-notifications-cron`.
  - `chat_contacts` (nome/telefone) por `contact_id`, deduplicando por telefone como no cron.
  - `chat_messages` (últimas mensagens não internas dessas conversas) para obter o texto/tipo/`from_me`/`timestamp` da última mensagem — `chat_conversations` não guarda o texto da última mensagem.
  - Retorna itens com `dueAt = last_customer_message_at + minutes`, flag `eligible`, e a prévia da mensagem.
- Todo acesso a dados pelo `extend/db.ts` do módulo; texto formatado com o helper de prévia de mensagem já existente e telefone/horário com os utilitários atuais (máscara BR, relativo pt-BR) — reexportados via `extend/` se ainda não estiverem.
- Novo componente `components/NoResponsePreview.tsx`, renderizado por `AlertTriggerCard.tsx` apenas quando `trigger.usesSilenceMinutes`.
- Nenhuma mudança de schema, de edge function ou nos outros gatilhos.
