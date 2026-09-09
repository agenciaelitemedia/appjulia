---
name: MCP — gestão de cards e contatos
description: Ferramentas de escrita do conector MCP para criar card no quadro, criar e atualizar contato, com dry-run e auditoria
type: feature
---
Conector MCP (`copiloto-mcp` + `_shared/copiloto/tools/escrita.ts`), escopo `julia:write.crm`:

- `julia_card_criar` — cria card em `crm_deals`; valida quadro do `client_id` do token, etapa pertencente ao quadro e ativa; `cod_agent` vem do quadro; posição = fim da coluna; grava `crm_deal_history` action `created`.
- `julia_contato_criar` — cria em `chat_contacts`; antiduplicidade pelos últimos 8 dígitos do telefone → devolve DUPLICATE sem criar.
- `julia_contato_atualizar` — allowlist: `name`, `lead_email`, `lead_full_name`, `lead_personalid`. Nunca altera telefone, client_id, canal ou contadores.

Regra transversal (todas as escritas): `idempotency_key` obrigatório, `dry_run` true por padrão, `approved_by` exigido para aplicar, `expected_version` opcional (CONFLICT), auditoria em `cop_write_audit`, telemetria em `cop_tool_calls`, 20 escritas/min por token. `client_id` sempre do token OAuth, nunca de argumento.
