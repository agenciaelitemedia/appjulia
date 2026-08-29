# MCP da Julia — v2: catálogo completo de leitura + tools de análise jurídica

Objetivo: sair das 3 tools atuais (`buscar_lead`, `obter_historico`, `analisar_atendimento`) para um catálogo completo e documentado, cobrindo tudo que hoje existe no sistema, **apenas leitura** — mais tools de análise que devolvem contexto compilado + instrução jurídica para o modelo do OpenClaw/Claude/ChatGPT produzir o parecer.

Base: `docs/MCP_julia.md`. Adaptações necessárias porque o doc assume coisas que o código não tem: autenticação é o OAuth próprio já implantado (`cop_oauth_tokens`), não `chat_api_keys`; CRM clássico, contratos ZapSign, usuários e agentes vivem no Postgres legado (acesso só via `db-query`); `chat_conversation_summaries` é o nome real da tabela de resumos.

## Princípios (mantidos e reforçados)

- `client_id` **nunca** vem por argumento: sai sempre do token OAuth. Todo acesso ao legado leva `client_id`/`cod_agent` do escritório do token.
- Somente leitura. Nenhuma tool escreve, envia mensagem, move card ou cria nota (o `julia_chat_enviar_nota_interna` do doc fica **fora** desta fase).
- Escopos: `leads:read` continua valendo (compatibilidade) e passa a englobar o catálogo de leitura; novo escopo opcional `julia:read` exibido no consentimento.
- Limites duros por tool (máx. 100 mensagens, 200 registros em listagens) e truncagem de texto para não explodir a janela do modelo.
- Toda tool devolve texto legível (Markdown/lista) — não JSON cru — porque é o que o modelo consome melhor; tools de listagem incluem os IDs necessários para a próxima chamada.

## Catálogo de tools (leitura)

### Chat e atendimento
| Tool | O que faz | Argumentos |
|---|---|---|
| `julia_chat_listar_conversas` | Lista conversas do inbox com filtros | `status`, `queue_id`, `assigned_user_id`, `busca`, `tag`, `limite` |
| `julia_chat_obter_conversa` | Dossiê da conversa: protocolo, canal, fila, responsável, prioridade, SLA (1ª resposta, resolução), motivo/nota de encerramento, tags, snooze, ticket vinculado | `conversation_id` |
| `julia_chat_ler_mensagens` | Histórico cronológico com papel (CLIENTE/ATENDENTE/NOTA), autor, tipo, texto, transcrição de áudio e nome de anexo | `conversation_id` \| `contato_id`, `limite`, `desde`, `ate` |
| `julia_chat_listar_arquivos` | Lista anexos da conversa (nome, tipo, quem enviou, data) com URL assinada temporária | `conversation_id` |
| `julia_chat_ler_conteudo_arquivo` | Extrai texto de PDF/imagem (OCR) de um anexo, paginado | `message_id`, `max_paginas` |
| `julia_chat_historico_atendimento` | Auditoria: abertura, transferências, devolução à fila, snooze, encerramentos | `conversation_id` |
| `julia_chat_listar_resumos` | Resumos de IA já gravados no atendimento | `conversation_id` |

### Contatos
| Tool | O que faz | Argumentos |
|---|---|---|
| `julia_contatos_buscar` | Busca por telefone (com variantes de 9º dígito), nome ou e-mail | `termo`, `limite` |
| `julia_contatos_obter_perfil` | Dossiê 360º: cadastro, canais, conversas anteriores, cards de CRM vinculados, contratos, ligações registradas | `contato_id` |

### CRM de Leads (legado, via `db-query`)
`julia_crm_listar_estagios`, `julia_crm_listar_cards` (`stage_id`, `cod_agent`, `busca`, `limite`), `julia_crm_obter_card` (com histórico de etapas e notas), `julia_crm_metricas` (`period_days`: leads captados, conversão por etapa, tempo médio, leads travados).

### CRM Builder (Supabase)
`julia_builder_listar_boards`, `julia_builder_listar_deals` (`board_id`, `pipeline_id`, `status`, `limite`), `julia_builder_obter_deal` (campos customizados, checklists, histórico, notas internas, conversas vinculadas).

### Contratos ZapSign (legado)
`julia_contratos_listar` (`status_document`, `busca`, `limite`), `julia_contratos_obter_detalhes` (`doc_token`: partes qualificadas, categoria do caso, resumo fático, datas, status de assinatura), `julia_contratos_obter_link` (`doc_token`: link de download do assinado).

### Filas, canais e roteamento
`julia_filas_listar` (canal, número, status de conexão, agente IA vinculado), `julia_filas_regras_roteamento` (estratégia, capacidade por atendente).

### Campanhas
`julia_campanhas_listar` (chat + módulo Disparos: público, agendamento, enviadas/entregues/falhas), `julia_campanhas_ads_listar` (leads do Meta Ads no legado).

### Equipe, permissões e agentes de IA
`julia_equipe_listar` (nome, e-mail, papel, ativo), `julia_usuarios_obter_permissoes` (`user_id`), `julia_agentes_listar` (cod_agent, alias, horário, status), `julia_agentes_obter_status` (`phone`, `cod_agent`).

### Telefonia e tickets
`julia_ligacoes_listar` (`contato_id`/`telefone`: ZapCall + VoIP, status amigável, duração, gravação), `julia_tickets_listar` (`status`, `limite`), `julia_tickets_obter` (`ticket_id`).

## Tools de análise (contexto + instrução, sem IA da Julia)

Cada uma compila os dados necessários e devolve **um bloco de instrução + o dossiê**; a análise é gerada pelo modelo do cliente MCP.

| Tool | Entrega |
|---|---|
| `julia_analise_atendimento` | Como foi o atendimento, qualidade, pendências, próximo passo (substitui/renomeia a atual `analisar_atendimento`, mantida como alias) |
| `julia_analise_viabilidade_juridica` | Parecer de viabilidade: fatos, enquadramento legal, prescrição, provas existentes e faltantes, veredito SIM/NÃO/INCONCLUSIVO, teses adicionais |
| `julia_analise_documental` | Checklist documental: lê anexos da conversa e aponta documentos faltantes e inconsistências |
| `julia_analise_qualificacao_lead` | Score de qualificação comercial (interesse, urgência, capacidade, etapa do CRM, tempo parado) e recomendação de ação |
| `julia_analise_risco_prescricao` | Linha do tempo dos fatos e alerta de prazos prescricionais/decadenciais a confirmar |
| `julia_analise_contrato` | Confronta contrato ZapSign com o relato da conversa: partes, objeto, divergências, pendências de assinatura |

Instruções padronizadas em `_shared/copiloto/prompts/*.ts` (uma por análise), reaproveitando o formato já aprovado em `ANALYSIS_COMMAND`.

## Recursos e prompts MCP

- Resources: `julia://conversa/{id}`, `julia://lead/{card_id}`, `julia://contrato/{doc_token}`, `julia://equipe`, `julia://metricas/crm`.
- Prompts MCP: `parecer_viabilidade`, `auditoria_documental`, `relatorio_atendimento`, `qualificar_lead` — atalhos de 1 comando que encadeiam as tools acima.

## Detalhes técnicos

- `supabase/functions/_shared/copiloto/` passa a ter um registry: `tools/index.ts` (catálogo + dispatch) com um arquivo por domínio (`chat.ts`, `contatos.ts`, `crm.ts`, `builder.ts`, `contratos.ts`, `filas.ts`, `campanhas.ts`, `equipe.ts`, `telefonia.ts`, `analises.ts`). Cada tool = `{ name, description, inputSchema, run(ctx, args) }`; `runCopilotoTool` só resolve pelo nome.
- Acesso ao legado: helper `legacyQuery(ctx, action, payload)` que chama a Edge Function `db-query` com service role, usando as actions existentes (`select`, `get_team_by_client`, `get_agents_list`, `get_user_permissions`, …) e **sempre** injetando o `client_id` do token; nada de `raw` vindo de argumento do modelo.
- `copiloto-mcp/index.ts`: acrescentar `resources/list`, `resources/read`, `prompts/list`, `prompts/get`; `tools/list` passa a vir do registry. Autenticação, `WWW-Authenticate` e discovery permanecem.
- Extração de texto de PDF/imagem: nova Edge Function `copiloto-extract` (leitura de `chat-media` por URL assinada + parser) chamada pela tool `julia_chat_ler_conteudo_arquivo`; sem OCR externo na v1 para imagens quando não houver texto — retorna aviso claro.
- Sem migrations: as tabelas `cop_oauth_*` permanecem. Só o `scope` gravado ganha `julia:read` para novas autorizações.
- Documentação: reescrever `docs/MCP_julia.md` como referência real da implementação (tabela por tool com argumentos, retorno e tabelas de origem) e listar as tools na página `/mvp-copiloto`, agrupadas por domínio.

## Validação

1. `tools/list` retorna todo o catálogo com schemas válidos; `prompts/list` e `resources/list` respondem.
2. Para um lead real: `julia_contatos_buscar` → `julia_chat_listar_conversas` → `julia_chat_ler_mensagens` → `julia_analise_viabilidade_juridica` no OpenClaw.
3. Token de um escritório não retorna dados de outro em nenhuma tool (incluindo as legadas via `db-query`).
4. Nenhuma tool grava: revisão do registry confirmando apenas `select` e chamadas de leitura.
