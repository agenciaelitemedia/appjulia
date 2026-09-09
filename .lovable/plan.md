# Lead "em atendimento" não aparece para a atendente responsável

## O que está acontecendo (confirmado nos dados)

O atendimento do contato **5516997293294** (Maria Aparecida Caminhas - ELVIS CRISTIAN) está em aberto e o responsável gravado é a Raquel (usuária 250).

Porém o nome do responsável é gravado como **texto livre**, e existem três grafias diferentes para a mesma pessoa nas conversas do escritório:

- `Raquel Souza` (12 caracteres)
- `Raquel Souza - Jurídico` (23 caracteres)
- `Raquel Souza - Jurídico ` (24 caracteres, com espaço no final) — grafia atual do cadastro dela

A lista do atendente filtra "em atendimento" comparando esse texto **exatamente igual** ao nome do usuário logado. O atendimento em questão ficou gravado com a grafia de 23 caracteres (sem o espaço final), então a comparação falha e a conversa desaparece da lista dela — enquanto o dono da conta, que vê tudo, continua enxergando o lead com o nome da Raquel.

Todas essas conversas já têm o **código numérico da usuária (250)** gravado corretamente ao lado do nome. Ou seja, existe um identificador confiável que hoje não está sendo usado no filtro.

## Correção proposta

1. Passar a decidir "esse atendimento é meu" pelo **código do usuário**, e não pelo nome escrito. O nome continua sendo aceito como reserva (para registros antigos sem código), mas comparado ignorando espaços sobrando e maiúsculas/minúsculas.
2. Padronizar os nomes já gravados: remover espaços no início/fim e, para os registros que têm código de usuário, alinhar a grafia com o cadastro atual. Isso conserta também os contadores de "em atendimento" e a capacidade, que sofrem do mesmo desencontro.
3. Ao atribuir um atendimento de agora em diante, gravar o nome já sem espaços sobrando, junto com o código do usuário.

Nada muda para o dono da conta e para administradores: eles continuam vendo todos os atendimentos.

## Detalhes técnicos

- `public.chat_list_feed` (RPC): trocar o filtro `p_restrict_open_to` por uma condição em duas partes — `b.assigned_user_id::text = ANY(...)` **ou** `btrim(lower(b.assigned_to)) = ANY(lower/btrim dos valores)`. Aplicar a mesma lógica ao filtro de responsável (`p_owners`) para evitar a mesma divergência nos filtros da barra.
- `src/modules/julia-chat/pages/JuliaChatPage.tsx`: `restrictOpenTo` continua enviando `[user.id, user.name]`, com `trim()` no nome.
- `src/modules/julia-chat/api/juliaChatActions.ts` (`juliaAssignConversation`) e demais gravações de `assigned_to`: aplicar `trim()` no nome antes de gravar.
- Migração de dados: `UPDATE chat_conversations SET assigned_to = btrim(assigned_to)` e, quando `assigned_user_id` existir, uniformizar a grafia; sincronizar também `chat_agent_capacity.agent_name` (hoje a linha da usuária 250 ainda guarda `Raquel Souza`).
- Verificação após aplicar: confirmar que a conversa `dcb5a207-...` volta a aparecer no feed com `p_restrict_open_to = ['250', 'Raquel Souza - Jurídico']` e que nenhum atendimento aberto fica sem correspondência de responsável.
