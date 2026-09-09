# Permissões do MCP por quadro + correção do erro do CRM Builder

## O que muda para você

No painel de permissões do quadro, acima do bloco de perfis, aparece um novo bloco **Acesso do MCP (Copiloto)** com:

- Quatro opções independentes: **Listar**, **Criar**, **Editar**, **Mover**.
- Todas começam desligadas em todos os quadros: enquanto você não liberar, o MCP não vê nem mexe naquele quadro.
- O **ID do quadro** visível com botão de copiar, para você colar no MCP e filtrar um quadro específico.
- Texto curto explicando o efeito de cada opção.

Somente o dono do quadro ou um administrador pode alterar essas opções (mesma regra do bloco de perfis).

## Efeito no MCP

- **Listar desligado**: o quadro não aparece na listagem de quadros do MCP, e os negócios dele não são retornados nas consultas.
- **Criar desligado**: criar card naquele quadro é recusado com mensagem clara.
- **Editar desligado**: alterar campos de um card do quadro é recusado.
- **Mover desligado**: mudar a etapa/status de um card do quadro é recusado.
- A recusa acontece antes de qualquer gravação, inclusive em simulação, e continua registrada na auditoria.

## Correção do erro

O erro "crm_boards.is_active does not exist" vem da ferramenta de listagem de quadros do MCP, que consulta uma coluna que não existe nessa tabela. A coluna correta é a de arquivamento. Após o ajuste a ferramenta volta a responder, marcando quadros arquivados.

## Detalhes técnicos

Armazenamento: sem migração. As opções ficam em `crm_boards.settings.mcp = { list, create, edit, move }` (booleanos, ausência = falso).

Frontend — `src/pages/crm-builder/components/settings/permissions/PermissionsManager.tsx`:
- Novo bloco acima do bloco "Permissão por", com 4 switches e o board id (`board.id`) num campo somente-leitura + `navigator.clipboard`.
- Salva via `supabase.from('crm_boards').update({ settings: { ...board.settings, mcp } })`, chama `onBoardUpdated` e invalida `['crm-boards', clientId]` (mesmo padrão de `handleModeChange`).

Backend — novo helper `supabase/functions/_shared/copiloto/board-access.ts`:
- `getBoardMcpAccess(ctx, boardId)` lê `crm_boards` (por `client_id` + `id`) e devolve as flags.
- `assertBoardMcpAccess(ctx, boardId, 'list'|'create'|'edit'|'move')` lança `CopilotoError("FORBIDDEN", ...)` quando negado.
- `listMcpAllowedBoardIds(ctx)` devolve os ids com `list` habilitado.

`supabase/functions/_shared/copiloto/tools/crm.ts`:
- `julia_builder_listar_quadros`: troca `is_active` por `is_archived` (rótulo "(arquivado)") e filtra pelos quadros com `list` liberado; se nenhum, retorna aviso de que o acesso do MCP não foi liberado.
- `julia_builder_listar_negocios`: restringe a `board_id` permitidos (`.in('board_id', allowed)`); se vier `board_id` não permitido, erro `FORBIDDEN`.
- `julia_builder_obter_negocio`: valida `list` no `board_id` do negócio.

`supabase/functions/_shared/copiloto/tools/escrita.ts`:
- `julia_card_criar`: `assertBoardMcpAccess(..., 'create')` após resolver o quadro.
- `julia_lead_alterar_estagio`: `assertBoardMcpAccess(before.board_id, 'move')`.
- `julia_lead_atualizar`: `assertBoardMcpAccess(deal.board_id, 'edit')` quando o alvo é um card do Builder.

Verificação: `bunx tsgo`, build, deploy de `copiloto-mcp`, e chamada real da listagem de quadros para confirmar o fim do erro de coluna.
