# MCP: gerenciar cards do quadro e contatos com segurança

## Como funciona hoje (verificado no código)

O conector MCP (`copiloto-mcp` + catálogo em `_shared/copiloto/tools/`) já tem um modelo de escrita segura pronto:

- o escritório (`client_id`) vem **sempre do token OAuth**, nunca de argumento;
- escopos separados: `julia:read`, `julia:write.crm`, `julia:write.messages`;
- toda escrita exige `idempotency_key`, simula por padrão (`dry_run: true`) e só aplica com `approved_by`;
- `expected_version` evita sobrescrever alteração de outra pessoa (CONFLICT);
- allowlist de campos, sem SQL livre e sem nome de tabela em argumento;
- tudo registrado em `cop_write_audit` (antes/depois, motivo, quem aprovou) e telemetria em `cop_tool_calls`;
- limite de 20 escritas/minuto por token.

Já existentes: mover card de etapa/status (`julia_lead_alterar_estagio`), editar campos do card (`julia_lead_atualizar`), definir responsável (`julia_lead_atribuir_responsavel`), buscar contato (`julia_contatos_buscar`) e ver perfil (`julia_contatos_obter_perfil`).

**Falta**: criar card no quadro, criar contato e editar dados do contato.

## O que será adicionado

Três novas ferramentas de escrita em `_shared/copiloto/tools/escrita.ts`, seguindo exatamente o mesmo padrão (dry-run, aprovação, idempotência, auditoria), escopo `julia:write.crm`:

1. **`julia_card_criar`** — cria card no quadro.
   - Argumentos: `board_id`, `pipeline_id` (etapa), `title`, e opcionais `contato_id` ou `telefone`, `contact_name`, `contact_email`, `value`, `priority`, `assigned_to`, `description`.
   - Validações: quadro precisa ser do escritório do token; a etapa precisa pertencer ao quadro; título obrigatório; posição calculada no fim da coluna; `status: open`.
   - Se `contato_id`/`telefone` for informado, valida que o contato é do mesmo escritório e vincula.

2. **`julia_contato_criar`** — cria contato/lead.
   - Argumentos: `telefone` (obrigatório), `nome`, `email`, `canal` (padrão WhatsApp), `observacao`.
   - Normaliza o telefone e, antes de criar, procura duplicado pelos últimos 8 dígitos no mesmo escritório: se existir, devolve o contato encontrado como `DUPLICATE` em vez de criar outro.

3. **`julia_contato_atualizar`** — edita dados do contato.
   - Allowlist de campos: `nome`, `email`, `observacao`/notas e campos de perfil equivalentes já presentes em `chat_contacts`. Não permite trocar `client_id`, telefone-chave nem contadores.
   - `expected_version` com `updated_at`.

Também: registrar as três no catálogo (`meta`/`getToolCatalogMarkdown`) para que o modelo as descubra, e completar o `resources` de políticas com a regra "criação sempre com dry-run primeiro".

## Fluxo recomendado para o agente

1. `julia_contatos_buscar` (telefone) → se nada, `julia_contato_criar`.
2. `julia_builder_listar_quadros` + etapas → `julia_card_criar` com `dry_run: true`.
3. Confirmação humana → repetir com `dry_run: false` e `approved_by`.
4. Depois: `julia_lead_atualizar` / `julia_lead_alterar_estagio` / `julia_lead_atribuir_responsavel`.

## Notas técnicas

- Tabelas usadas: `crm_deals`, `crm_pipelines`, `crm_boards`, `chat_contacts`, `crm_deal_history`, `cop_write_audit`.
- `julia_card_criar` grava também a entrada inicial em `crm_deal_history` (mesmo padrão do app).
- Nenhuma ferramenta de leitura existente é alterada; nenhuma migração de banco é necessária.
- Verificação: `bunx tsgo --noEmit`, deploy de `copiloto-mcp` e teste via `mcp_capabilities` + uma criação em `dry_run`.
