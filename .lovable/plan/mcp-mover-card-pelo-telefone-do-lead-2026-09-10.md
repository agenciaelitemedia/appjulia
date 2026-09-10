# MCP: mover card pelo telefone do lead

Nova ferramenta única que recebe **telefone + etapa + código do painel** e move o card na hora.

## Como vai funcionar

Ferramenta `julia_card_mover_por_telefone` (escopo de escrita do CRM):

Parâmetros:
- `telefone` (obrigatório) — aceita qualquer formato (com +55, parênteses, traços).
- `etapa` (obrigatório) — ID da etapa **ou** o nome dela (ex.: "Atendimento humano").
- `board_id` (obrigatório) — o código do painel copiável na tela de permissões do quadro.
- `status` (opcional) — `open`, `won` ou `lost`.
- `motivo` (opcional) — vai para o histórico do card.
- `dry_run` (opcional, padrão **false**) — aplica direto; passe `true` para só simular.

Passos executados:
1. Normaliza o telefone e gera as duas variantes brasileiras (12 e 13 dígitos, com e sem o nono dígito).
2. Confere que o painel pertence ao escritório do token e que a opção **Mover** está liberada para o MCP nesse painel.
3. Procura o card no painel, sempre filtrado pelo escritório (`client_id` do token):
   - primeiro pelo telefone do card;
   - se não achar, pelo contato do chat (mesmas variantes) e pelos cards vinculados a esse contato.
   - considera só cards abertos e não arquivados; se houver mais de um, usa o de movimentação mais recente e informa quantos foram encontrados.
4. Resolve a etapa: por ID (precisa ser do mesmo painel) ou por nome (comparação sem acento/maiúsculas, entre as etapas ativas do painel).
5. Move o card, atualizando a data de entrada na etapa, e grava o evento `moved` no histórico do card com autor MCP e motivo.
6. Registra a operação na auditoria do conector.

Respostas claras quando não dá para mover: contato não encontrado, contato existe mas sem card no painel, etapa inexistente, painel sem permissão de mover, card já está na etapa (devolve sucesso sem alterar).

## Detalhes técnicos

- Arquivo: `supabase/functions/_shared/copiloto/tools/escrita.ts` (mesmo padrão de `julia_lead_alterar_estagio`), registrada no catálogo em `tools/index.ts` / `meta.ts`.
- Variantes de telefone: mesma lógica de `supabase/functions/_shared/phone-normalize.ts` (`brPhoneVariants`).
- Busca: `crm_deals` (`client_id`, `board_id`, `contact_phone` in variantes, `status`/arquivado) + fallback por `chat_contacts.phone` in variantes e `custom_fields.links.chat.contact_id`.
- Permissão: `assertBoardMcpAccess(ctx, board_id, "move")` — padrão fechado, como hoje.
- `idempotency_key` gerada automaticamente quando não informada (telefone + etapa + dia), e `approved_by` não é exigido nesta ferramenta, já que o próprio comando é a autorização; tudo continua auditado em `cop_write_audit`.
- Nenhuma migração de banco; nenhuma ferramenta existente é alterada.
- Verificação: `bunx tsgo --noEmit`, deploy de `copiloto-mcp` e teste real com um telefone conhecido do escritório (simulação + aplicação).
