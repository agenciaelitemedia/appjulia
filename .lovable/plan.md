# MCP Atende Julia — evolução para o contrato do backlog (P0 + P1 + escrita controlada)

## Inventário atual (verificado no código)

35 tools registradas em `supabase/functions/_shared/copiloto/tools/` (6 domínios: contatos, chat, crm, contratos, operação, análise). Todas são somente leitura e devolvem **texto Markdown** montado à mão; não existe `mcp_capabilities`, `mcp_health`, cursor, `coverage`, `request_id`, erro estruturado nem escopo de escrita. Paginação hoje é `limite`/`offset` em algumas tools; `julia_contatos_buscar` escolhe silenciosamente entre telefone e nome; presença de equipe já foi separada dentro de `julia_equipe_listar` (mas não como tool própria).

Classificação por requisito do backlog:

| Requisito | Situação |
|---|---|
| 1 `mcp_capabilities` | criar |
| 2 `mcp_health` | criar |
| 3 `listar_leads` (cursor + coverage) | ajustar (`julia_crm_listar_leads`, `julia_chat_listar_conversas`) |
| 4 busca determinística | ajustar (`julia_contatos_buscar`) |
| 5 histórico paginado por evento | ajustar (`julia_chat_ler_mensagens`, `julia_chat_historico_atendimento`) |
| 6 usuários vs presença | ajustar + criar `julia_equipe_presenca` |
| 7 métricas de funil no servidor | ajustar (`julia_crm_metricas_funil`) |
| 8 follow-ups pendentes | criar |
| 9 documentos do lead | ajustar (`julia_chat_listar_arquivos`) |
| 10 timeline de contratos | criar (`julia_contratos_eventos`) |
| 11 SLA/qualidade | criar (`julia_atendimento_metricas`) |
| P2 escritas específicas | criar (5 tools + escopos novos) |
| Erros/versão/auditoria | criar (camada transversal) |

## Fase 0 — camada transversal (base de tudo)

Novo `supabase/functions/_shared/copiloto/envelope.ts`:

- `ok(payload, meta)` devolve **JSON estruturado** (`structuredContent`) **e** um resumo em texto, conforme sua escolha: cada tool retorna `{ json, text }`; o dispatcher entrega os dois ao cliente MCP.
- Metadados obrigatórios em toda resposta: `generated_at` (ISO 8601 com offset), `request_id` (UUID por chamada), `schema_version`, `tool_version`.
- `coverage`: `{ complete, from, to, warnings[] }` — marcado `false` sempre que houver corte por limite, dependência degradada ou fonte legada indisponível.
- Paginação por **cursor opaco** (base64 de `{ sort_key, id }`) com ordenação estável `(chave, id)`, mantendo `has_more`, `next_cursor` e `total_count` (via `count: "exact"` quando viável, senão `total_count: null` + aviso). `offset` continua aceito por compatibilidade e marcado como deprecado.
- `fail(code, message, {retryable, dependency, details})` no formato de erro do backlog, sem SQL/stack/token. Códigos: `INVALID_INPUT`, `NOT_FOUND`, `AMBIGUOUS_MATCH`, `PERMISSION_DENIED`, `DEPENDENCY_UNAVAILABLE`, `RATE_LIMITED`, `CONFLICT`, `IDEMPOTENT_REPLAY`, `APPROVAL_REQUIRED`, `INTERNAL`.
- Timezone: todo filtro aceita `timezone` (padrão `America/Sao_Paulo`); datas de saída em ISO com offset, mais campo legível.
- Anti-prompt-injection: todo texto vindo de lead/documento sai dentro de blocos delimitados marcados como `untrusted_content`, com nota de que não são instruções.
- `CopilotoTool` ganha `version`, `mode: read|write`, `requiredScope`, `deprecated`, `replacedBy`, `removalDate`.

Dispatcher (`tools/index.ts` + `copiloto-mcp/index.ts`): valida input contra schema, injeta `request_id`, mede latência, converte exceções em erro estruturado, aplica rate limit por token/tool e grava auditoria.

## Fase 1 — P0

1. **`mcp_capabilities`** — versão do servidor, `schema_version`, escopos OAuth do token, lista de tools com versão, modo, escopo exigido e depreciação.
2. **`mcp_health`** — checagem rápida e paralela de `database` (Supabase), `legacy_presence`/`legacy_db` (via `db-query`), `messaging` (fila ativa), `contracts` (ZapSign config) e `storage`; status `healthy|degraded|unavailable` por dependência com latência, sem expor segredo. Falha do legado nunca derruba as tools independentes.
3. **`julia_leads_listar`** (nova, canônica) — coorte de leads com filtros `created_from/to`, `updated_from/to`, `status[]`, `responsavel_id[]`, `canal[]`, `estagio[]`, `timezone`, `cursor`, `limit`; itens com `contato_id`, `lead_id`, nome, canal, status, estágio, responsável e datas. `julia_crm_listar_leads` e `julia_chat_listar_conversas` passam a usar cursor+coverage e apontam para ela na descrição.
4. **`julia_contatos_buscar` determinística** — aceita `contato_id`, `lead_id`, telefone normalizado, e-mail ou nome; devolve `match_type` (`id|phone|email|name`) e `confidence`; múltiplos resultados → `AMBIGUOUS_MATCH` com candidatos identificáveis (sem escolha arbitrária) e PII reduzida ao necessário para desambiguar.
5. **Histórico por eventos** — `julia_chat_ler_mensagens` ganha `event_types` (`message|status_change|assignment|contract|note`), `order`, `from/to`, `cursor`; cada evento com `event_id`/`message_id`, timestamp com offset, tipo, canal, direção, autor (`lead|agent|automation|system`), `author_id/name`, texto ou `null` + `availability_reason`, metadados de anexo (nome, MIME, tamanho, link) sem exigir download, status de entrega/leitura e `reply_to`. Eventos de sistema nunca aparecem como mensagem humana.
6. **Usuários vs presença** — `julia_equipe_listar` volta ao cadastro (id, nome, função, equipe, ativo/inativo, permissões resumidas, datas) e a presença sai para **`julia_equipe_presenca`** (`presence: online|offline|away|unknown`, `presence_available`, `last_seen_at`, `source`, `observed_at`, `warnings[]`). `ativo` nunca é sinônimo de `online`.

## Fase 2 — P1

7. **`julia_funil_metricas`** — no servidor, por período/timezone/canal/responsável/equipe/origem, com etapas separadas (recebidos, 1ª resposta, atendimento iniciado, triagem, qualificado/não qualificado/pendente, proposta, contrato gerado/enviado/visualizado/assinado, perdido com motivo, tempos entre etapas) e cada métrica com numerador, denominador, taxa, definição e cobertura — reconciliável com `julia_leads_listar`.
8. **`julia_followups_pendentes`** — fatos apenas: lead, contato, responsável, estágio, última interação, próximo passo, prazo, motivo da pendência e sinais de urgência (sem cálculo de prioridade).
9. **`julia_documentos_listar`** — metadados: id, tipo, nome seguro, origem, data, status de processamento, tamanho, MIME e referência; leitura de conteúdo continua isolada em `julia_chat_ler_conteudo_arquivo`. Validade jurídica nunca afirmada como fato.
10. **`julia_contratos_eventos`** — timeline com estados distintos `drafted|generated|sent|viewed|signed|declined|expired|cancelled`, cada um com id, contrato, lead, timestamp, origem e evidência; nunca inferir `signed` a partir de `sent`.
11. **`julia_atendimento_metricas`** — 1ª resposta, intervalos entre mensagens, dentro/fora do expediente, transferências com responsável por intervalo, encerramentos e reaberturas, automáticas vs humanas.

## Fase 3 — P2 escrita controlada

Novo arquivo `tools/escrita.ts` com 5 tools específicas (nenhuma genérica): `julia_lead_atualizar`, `julia_lead_atribuir_responsavel`, `julia_followup_registrar`, `julia_lead_alterar_estagio`, `julia_mensagem_enviar`.

Contrato comum de entrada: `dry_run` (padrão **true**), `idempotency_key` (obrigatório), `reason`, `expected_version`, `approved_by`. Saída: `applied`, `dry_run`, `before`, `after`, `audit_id`, `request_id`.

- Escopos OAuth novos: `julia:write.crm` (4 primeiras) e `julia:write.messages` (envio); leitura permanece `julia:read`/`leads:read`. Token sem o escopo → `PERMISSION_DENIED`.
- Aprovação humana: execução real exige `dry_run:false` **e** `approved_by`; sem isso → `APPROVAL_REQUIRED`.
- Concorrência otimista por `expected_version` (`updated_at`/versão do registro) → `CONFLICT` em divergência.
- Idempotência real: nova tabela `cop_write_audit` grava `idempotency_key` único por token, ator, ação, alvo, motivo, aprovação, before/after e resultado; retry devolve o mesmo `audit_id` com `IDEMPOTENT_REPLAY`.
- Allowlist de campos e de transições de estágio; envio de mensagem restrito a filas do escritório e sujeito às regras anti-ban existentes.
- Nada de gerar/assinar/enviar contrato nem protocolo por aqui — fora do escopo, exigiria gate próprio.

P3 (webhooks assinados) fica documentado como próximo passo, não implementado agora.

## Documentação, telas e testes

- `docs/MCP_julia.md`: reescrita por domínio com schema de entrada/saída, escopo, versão, limites, changelog e exemplos; seção de depreciações.
- `/mvp-copiloto`: `ToolCatalogCard.tsx` passa a consumir o catálogo com modo (leitura/escrita), escopo e versão; simulador ganha aba de dry-run e exibe o JSON estruturado.
- Testes Deno em `supabase/functions/copiloto-mcp/`: contrato de todas as tools, paginação (0, 1, limite exato, várias páginas, inserção concorrente), timezone e virada de dia, homônimos/telefones duplicados/ID inválido, histórico com texto/áudio/imagem/documento/automação/sistema, dependência parcial fora do ar, idempotência e concorrência de escrita, controle por escopo, reconciliação do funil.
- Redeploy de `copiloto-mcp` ao final de cada fase (os arquivos `_shared` só valem após deploy) e smoke test: sem Bearer → 401; `mcp_health` → 200.

## Ordem de entrega sugerida

Fase 0 → Fase 1 (P0) → validação/homologação → Fase 2 (P1) → Fase 3 (escrita, com escopos e auditoria) → documentação final.
