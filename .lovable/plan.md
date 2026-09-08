# Por que Júlia (juliacruzcgs@gmail.com) não entrou na equipe do cliente 300

## O que aconteceu (confirmado nos dados)

- Júlia Gomes foi criada hoje (id 430), papel "comercial", ativa.
- No cadastro, ela foi vinculada como titular ao **Charles Vianna** (id 209), e não ao titular do escritório (Tell Moitas, id 21).
- O Charles é ele mesmo um membro de equipe e está **sem escritório definido** (client_id vazio) — ele também não aparece na equipe do 300.
- Como o escritório da Júlia é herdado do titular escolhido, e esse titular está vazio, a Júlia ficou sem escritório e por isso não aparece na equipe do cliente 300.

Ou seja: não é erro de tela, é herança de escritório em dois níveis. O sistema só olha **um nível acima** (titular direto). Quando o titular escolhido também é um membro, a herança se perde.

## Correção proposta

1. **Herança em cadeia**: ao criar/editar um membro, resolver o escritório subindo a cadeia de titulares até encontrar um escritório definido (com limite de segurança contra laços), em vez de olhar apenas o titular direto.
2. **Listagem da equipe**: aplicar a mesma resolução em cadeia na visão usada pela página Equipe, para que membros de segundo nível apareçam corretamente.
3. **Evitar o caso na origem**: na seleção de titular do cadastro, mostrar/sinalizar apenas titulares com escritório válido, para não permitir criar membro "órfão".
4. **Correção dos registros atuais**: definir o escritório 300 para Charles Vianna (209) e para Júlia Gomes (430), e verificar se existem outros membros na mesma situação (titular sem escritório) para corrigir junto.

## Detalhes técnicos

- Criação/edição: `src/pages/equipe/hooks/useEquipeData.ts` (`useCreateTeamMember` faz `SELECT client_id FROM users WHERE id = $1`, sem subir a cadeia) e as ações `insert_team_member` / `update_team_member` em `supabase/functions/db-query/index.ts`.
- Resolução em cadeia: nova consulta recursiva (`WITH RECURSIVE`) em `db-query`, reutilizada por `get_effective_client_id`, `get_team_by_client` e `create_vw_equipe` (hoje usam apenas `COALESCE(u.client_id, p.client_id)`).
- Reparo de dados: `UPDATE users SET client_id = 300 WHERE id IN (209, 430)` + varredura de membros com titular sem `client_id`.
- Verificação: recarregar a página Equipe do cliente 300 e confirmar Júlia e Charles na lista; conferir que a resolução de escritório usada no chat/CRM (`resolveEffectiveClientId`) passa a retornar 300 para ela.
