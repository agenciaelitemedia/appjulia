# Busca de card por telefone no MCP: mostrar só o que aparece no CRM

## O que está acontecendo (verificado nos dados)

No painel `50365943-…` do escritório 30, o telefone `5534988860163` tem **19 cards no banco**:

- 1 aberto (é o único que você vê no CRM)
- 16 arquivados
- 2 marcados como perdidos

A ferramenta de mover (`julia_card_mover_por_telefone`) já filtra apenas cards **abertos**, então ela encontra 1.
O "14 registros" veio da ferramenta de **listagem de negócios** (`julia_builder_listar_negocios`), que hoje **não filtra status** e devolve arquivados e perdidos junto — cards que não existem mais na tela do CRM.

Há também **dois contatos duplicados** do mesmo lead Mário Castro: `553488860163` (sem o 9) e `5534988860163` (com o 9).

## O que será feito

1. **Listagem só com o que está no CRM**: a listagem de negócios passa a excluir cards arquivados por padrão (mesma regra da tela). Um parâmetro opcional `incluir_arquivados` permite ver o histórico quando alguém pedir explicitamente.
2. **Filtro por painel e por telefone na listagem**: aceitar `board_id` e `telefone` (com as variantes de 12 e 13 dígitos), para a busca por telefone dar sempre o mesmo resultado da tela.
3. **Busca por telefone unificada**: uma única função interna de resolução por telefone, usada tanto pela listagem quanto pela movimentação — normalização BR (com/sem o 9), busca pelo telefone do card, pelo contato do chat e pelos vínculos gravados no card. Sempre restrita ao escritório do token e ao painel informado.
4. **Contatos duplicados**: ao resolver o telefone, os dois contatos do mesmo lead são tratados como o mesmo lead (busca por todas as variantes), e o card usa o contato com nome preenchido. Não haverá exclusão de contato nesta etapa.
5. **Retorno mais claro**: a resposta passa a informar quantos cards visíveis foram encontrados e, separadamente, quantos existem apenas no histórico, para não parecer "14 cards no CRM".

## Parâmetros da ferramenta de movimentação

Obrigatórios:
- `telefone` — qualquer formato (`5534988860163`, `553488860163`, `(34) 98886-0163`)
- `etapa` — UUID da etapa ou o nome dela (ex.: `Captura`)
- `board_id` — código do painel (ex.: `50365943-5774-4b7b-8406-3023e5c3bdf5`)

Opcionais:
- `status` — `open`, `won` ou `lost`
- `motivo` — texto gravado no histórico do card
- `dry_run` — `true` apenas simula (o padrão é aplicar)
- `idempotency_key` — evita repetir a mesma movimentação

O escritório (`client_id`) **não é passado**: vem do token da conexão. Para o Mário, o token precisa ser o do escritório 30.

## Detalhes técnicos

- `supabase/functions/_shared/copiloto/tools/crm.ts`: em `julia_builder_listar_negocios`, adicionar `.neq('status','archived')` por padrão, novos parâmetros `board_id`, `telefone`, `incluir_arquivados`.
- `supabase/functions/_shared/copiloto/tools/escrita.ts`: extrair `resolveDealByPhone(ctx, boardId, phone)` a partir do bloco atual de `julia_card_mover_por_telefone`, expondo `visiveis` e `historico`; reaproveitar em crm.ts.
- Permissões por painel (`crm_boards.settings.mcp`) permanecem como estão: Listar/Criar/Editar/Mover independentes e fechados por padrão.
- Republicar `copiloto-mcp`; rodar typecheck e build.
