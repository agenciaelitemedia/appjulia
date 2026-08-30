# Conector MCP da Julia — documentação da implementação

Conector remoto (Model Context Protocol) que expõe os dados do escritório na Julia
para clientes oficiais de IA — OpenClaw, ChatGPT, Claude — usando a assinatura Pro
do próprio usuário. **Leitura por padrão; escrita apenas em cinco operações
explícitas, que simulam antes de aplicar.**

Contrato de resposta (schema `2026-08-30`, server `3.0.0`): toda tool devolve
`content[0].text` (resumo legível) **e** `structuredContent` com o JSON do
envelope: `coverage`, `pagination`, `timezone`, `tool`, `tool_version`,
`schema_version`, `server_version`, `generated_at`, `request_id`, `latency_ms`.
Erros vêm como `{ error: { code, message, retryable, dependency, details } }`
com `isError: true`. Códigos: `INVALID_INPUT`, `NOT_FOUND`, `AMBIGUOUS_MATCH`,
`PERMISSION_DENIED`, `RATE_LIMITED`, `DEPENDENCY_UNAVAILABLE`, `CONFLICT`,
`INTERNAL`.

Rota de gestão no painel: `/mvp-copiloto`.

## Endpoints

| Função | URL | Papel |
| --- | --- | --- |
| `copiloto-mcp` | público: `https://mcp.atendejulia.com.br` (proxy) | Resource Server MCP (JSON-RPC / Streamable HTTP) |
| `copiloto-oauth` | discovery/authorize em `https://acesso.atendejulia.com.br`; token/register/revoke na function | Authorization Server (OAuth 2.1 + PKCE S256 + DCR) |


Discovery: `/.well-known/oauth-authorization-server` (no OAuth) e
`/.well-known/oauth-protected-resource` (nos dois). Sem Bearer válido, o MCP
responde `401` com `WWW-Authenticate` apontando para o discovery.

Métodos JSON-RPC suportados: `initialize`, `notifications/initialized`, `ping`,
`tools/list`, `tools/call`, `resources/list`, `resources/read`, `prompts/list`,
`prompts/get`.

## Modelo de segurança

- Escopos: `leads:read`/`julia:read` (leitura), `julia:write:crm` (lead, etapa,
  responsável, follow-up) e `julia:write:messages` (envio de mensagem). O
  dispatcher recusa a tool quando o token não tem o escopo exigido.
- Escrita: `dry_run` é `true` por padrão; aplicar exige `dry_run: false`,
  `idempotency_key`, `approved_by` e `reason`. Toda tentativa (simulada ou
  aplicada) é gravada em `cop_write_audit`, e a mesma `idempotency_key` aplicada
  não repete a operação. Alterações de registro conferem `expected_version`
  (`updated_at`) e devolvem `CONFLICT` quando o dado mudou.
- Rate limit por token: 120 leituras e 20 escritas por minuto.
- Conteúdo enviado por leads (mensagens, legendas) sai delimitado em
  `<untrusted_content>` — é dado, nunca instrução.
- O escopo e o **escritório** ficam gravados no token
  (`cop_oauth_tokens.julia_client_id`), resolvidos no servidor durante o consentimento.
- **Nenhuma tool aceita `client_id`**, SQL ou nome de tabela como argumento. Todo
  filtro de tenant é aplicado no servidor.
- Banco legado é acessado só por `db-query` com SQL literal escrito no servidor e
  valores ligados como parâmetros; o escopo é o conjunto de `cod_agent` do escritório
  (`supabase/functions/_shared/copiloto/legacy.ts`).
- Limites: 100 mensagens por leitura de conversa, 200 registros por listagem,
  truncamento de texto para não estourar a janela do modelo.
- Tokens expiram, são renovados por refresh token e podem ser revogados na página
  do conector.

## Ferramentas acrescentadas nesta versão

| Tool | Papel |
| --- | --- |
| `mcp_capabilities` | Inventário de tools, versões, escopos, limites e campos cobertos. |
| `mcp_health` | Saúde de banco, base legada, presença, mensageria, contratos e arquivos. |
| `julia_leads_listar` | Coorte de leads com filtros, cursor opaco e cobertura declarada. |
| `julia_followups_pendentes` | Follow-ups abertos e atrasados, com responsável e prazo. |
| `julia_documentos_listar` | Documentos/mídias do lead com tipo, autor, data e link direto. |
| `julia_contrato_timeline` | Envio, cadências de cobrança e assinatura de um contrato. |
| `julia_equipe_presenca` | Presença/atividade da equipe, separada do cadastro de usuários. |
| `julia_funil_metricas` | Conversão por etapa, permanência e gargalos. |
| `julia_atendimento_metricas` | 1ª resposta, SLA, volume por canal, transferências e devoluções. |
| `julia_lead_atualizar` | **Escrita**: campos permitidos do lead (allowlist + versão esperada). |
| `julia_lead_atribuir_responsavel` | **Escrita**: define responsável do lead/atendimento. |
| `julia_lead_alterar_estagio` | **Escrita**: move o lead de etapa no mesmo funil. |
| `julia_followup_registrar` | **Escrita**: cria follow-up com prazo e responsável. |
| `julia_mensagem_enviar` | **Escrita**: envia mensagem pela fila do atendimento (WABA ou UaZapi). |

`julia_contatos_buscar` passou a ser determinística (v2): aceita `contato_id`,
`telefone`, `email` ou `nome`, devolve `match_type`/`confidence` e responde
`AMBIGUOUS_MATCH` com os candidatos em vez de escolher um homônimo.

## Arquitetura de arquivos

```text
supabase/functions/_shared/copiloto/
  types.ts        contratos, limites, helpers de formatação
  context.ts      compilador do histórico do lead
  legacy.ts       acesso ao Postgres legado (db-query) + escopo por cod_agent
  prompts.ts      comandos de análise entregues ao cliente MCP
  tools/index.ts  registry, catálogo e dispatch
  tools/contatos.ts  chat.ts  crm.ts  contratos.ts  operacao.ts  analise.ts
supabase/functions/copiloto-mcp/index.ts    endpoint MCP
supabase/functions/copiloto-oauth/index.ts  OAuth 2.1
src/modules/mvp-copiloto/                    UI de gestão do conector
```

## Catálogo de tools

### Contatos e leads

| Tool | Argumentos | Retorno | Origem |
| --- | --- | --- | --- |
| `julia_contatos_buscar` | `termo`, `limite` | leads com `contato_id`, telefone, canal, última mensagem | `chat_contacts` |
| `julia_contatos_obter_perfil` | `contato_id` | dossiê 360º: cadastro, atendimentos, cards do CRM, contratos, ligações | `chat_contacts`, `chat_conversations`, `crm_atendimento_cards`, `vw_painelv2_desempenho_julia_contratos`, `wavoip_call_logs`, `phone_call_logs` |

### Atendimento e mensagens

| Tool | Argumentos | Retorno | Origem |
| --- | --- | --- | --- |
| `julia_chat_listar_conversas` | `status`, `tab`, `queue_id(s)`, `responsavel`, `assigned_user_id`, `unassigned`, `busca`, `periodo`, `tag_ids`, `prioridade`, `com_ticket`, `com_crm_builder`, `sla`, `ordenar`, `limite`, `offset` | mesma consulta unificada da tela `/chat` (RPC `chat_list_feed`): contato, fila, protocolo, não lidas, última mensagem, SLA, etiquetas, ticket, CRM Builder, etapa CRM Julia, sessão Julia, campanha, snooze + contadores do escopo | RPC `chat_list_feed` |
| `julia_chat_obter_conversa` | `conversation_id` | dossiê do atendimento (fila, SLA, tags, encerramento, ticket) | `chat_conversations`, `queues`, `chat_conversation_tags` |
| `julia_chat_ler_mensagens` | `conversation_id` ou `contato_id`, `limite` (máx. 200), `incluir_links` (padrão true) | histórico cronológico com papéis, transcrições e **link público de cada arquivo** (imagem/áudio/vídeo/documento) + bloco `=== ARQUIVOS DA CONVERSA ===` | `chat_messages` + `chat-media-download` (materializa mídia criptografada no bucket público `chat-media`) |
| `julia_chat_listar_arquivos` | `conversation_id` ou `contato_id` | anexos com `message_id` e link público do arquivo | `chat_messages` + `chat-media-download` |
| `julia_chat_ler_conteudo_arquivo` | `message_id`, `max_paginas` | texto extraído de PDF/TXT/CSV (resolve link de mídia criptografada automaticamente) | `chat_messages` + `chat-media-download` |
| `julia_chat_historico_atendimento` | `conversation_id` | auditoria de transferências, devoluções e pausas | `chat_conversation_history` |
| `julia_chat_listar_resumos` | `conversation_id` ou `contato_id` | resumos de IA já gravados | `chat_conversation_summaries` |
| `julia_chat_listar_tags` | — | tags do escritório | `chat_tags` |

### CRM de Leads (legado) e CRM Builder

| Tool | Argumentos | Retorno | Origem |
| --- | --- | --- | --- |
| `julia_crm_listar_etapas` | — | etapas do funil com contagem | `crm_atendimento_stages/cards` |
| `julia_crm_listar_leads` | `stage_id`, `busca`, `dias_parado_min`, `limite` | leads com etapa, dias parado, responsável | `crm_atendimento_cards` |
| `julia_crm_historico_lead` | `card_id` | movimentações entre etapas | `crm_atendimento_history` |
| `julia_crm_metricas_funil` | `dias` | leads/percentual/permanência por etapa | idem |
| `julia_crm_notas_internas` | `telefone` | notas internas da equipe | `crm_internal_notes` |
| `julia_builder_listar_quadros` | — | quadros, etapas e contagem de negócios | `crm_boards`, `crm_pipelines`, `crm_deals` |
| `julia_builder_listar_negocios` | `board_id`, `pipeline_id`, `busca`, `limite` | negócios com valor, etapa, responsável | `crm_deals` |
| `julia_builder_obter_negocio` | `deal_id` | campos, checklists e histórico | `crm_deals`, `crm_checklists`, `crm_deal_history` |

### Contratos ZapSign

| Tool | Argumentos | Retorno |
| --- | --- | --- |
| `julia_contratos_listar` | `status`, `busca`, `dias`, `limite` | documento, status, signatário, caso, datas |
| `julia_contratos_obter` | `doc_token` | qualificação completa + resumo do caso |
| `julia_contratos_metricas` | `dias` | enviados, assinados, conversão, tempo até assinar |

Origem: view legada `vw_painelv2_desempenho_julia_contratos`.

### Operação

| Tool | Argumentos | Origem |
| --- | --- | --- |
| `julia_filas_listar` | — | `queues`, `queue_agent_links` |
| `julia_equipe_listar` | — | `users` (legado) + `user_presence_status`, `user_last_activity`, `chat_client_settings`, `chat_conversations`, `crm_deals`, `tasks` |
| `julia_agentes_listar` | — | `agents` (legado) |
| `julia_campanhas_listar` | `status`, `limite` | `dsp_campaigns` |
| `julia_telefonia_listar_chamadas` | `contato_id`, `dias`, `limite` | `wavoip_call_logs`, `phone_call_logs` |
| `julia_tickets_listar` | `status`, `limite` | `support_tickets` |
| `julia_tickets_obter` | `ticket_id` | `support_tickets`, `support_ticket_messages` |
| `julia_operacao_indicadores` | `dias` | `chat_conversations` (agregação em memória) |

`julia_equipe_listar` espelha o dashboard de Equipe (`/equipe`): além de nome,
e-mail, papel e acesso, retorna por usuário o status de presença
(Online/Ausente/Offline + "ativo há X", da view `user_presence_status`), último
login, último logout com selo Inatividade/Manual (view `user_last_activity`),
alerta de som ativo (`chat_client_settings.settings`) e os contadores de chats
abertos (open/pending), cards de CRM abertos (≠ won/lost) e tarefas abertas
(pending/in_progress), com a mesma regra de atribuição do dashboard
(`assigned_user_id` primeiro, fallback por nome). Abre com um resumo agregado.

### Análises

Estas tools **não geram parecer**: retornam o dossiê compilado mais o comando de
análise, e o modelo do cliente MCP escreve a resposta. Nenhuma IA interna da Julia
é chamada, nenhum crédito é consumido.

| Tool | Dossiê montado | Comando |
| --- | --- | --- |
| `julia_analise_atendimento` | conversa | condução, tema, pendências, próximo passo |
| `julia_analise_viabilidade_juridica` | conversa + resumos + anexos | fatos, enquadramento, prescrição, provas, veredito, outras teses |
| `julia_analise_documental` | anexos + texto extraído dos PDFs + conversa | o que cada documento comprova, inconsistências, checklist |
| `julia_analise_qualificacao_lead` | conversa + etapa do CRM + ligações | score 0-100, sinais, recomendação |
| `julia_analise_prescricao` | conversa | linha do tempo, prazos, risco, urgências |
| `julia_analise_contrato` | contrato + conversa | partes, divergências, pendências, recomendação |

## Resources e prompts

Resources: `julia://catalogo/tools`, `julia://escritorio/perfil`, `julia://politicas/uso`.

Prompts: `analise_atendimento`, `parecer_viabilidade`, `auditoria_documental`,
`qualificacao_lead`, `risco_prescricao`, `conferencia_contrato` — cada um aceita
`conversation_id` ou `contato_id`.

## Como conectar

1. Copie a URL do conector em `/mvp-copiloto`.
2. No OpenClaw, adicione um servidor MCP remoto (HTTP) com essa URL.
3. Faça login na Julia e autorize o consentimento (escopo de leitura).
4. As ferramentas aparecem no cliente; peça, por exemplo: *"busque o lead 5519…,
   leia a conversa e os documentos e faça o parecer de viabilidade"*.
5. Revogue a conexão a qualquer momento no cartão de conexões da página.

## Validação

- `tools/list` retorna 27 tools em 6 domínios; `resources/list` retorna 3; `prompts/list` retorna 6.
- Sem Bearer: `401` com `WWW-Authenticate`.
- Token de um escritório nunca retorna dados de outro (filtro por `client_id` e `cod_agent`).
- Nenhuma tool executa `insert`, `update` ou `delete`.

## Endereço do conector e autenticação (atualizado)

O issuer OAuth passou a ser a **raiz do domínio da Julia**
(`https://acesso.atendejulia.com.br`), porque clientes MCP montam
`/authorize` relativo à raiz do issuer — com o issuer em subcaminho do backend o
OpenClaw chamava `https://<backend>/authorize` e recebia
`{"error":"requested path is invalid"}`.

Peças envolvidas:

### Por que existe um proxy (e não só a URL da function)

Clientes MCP resolvem os endpoints OAuth **relativos à raiz do issuer**. Dois becos sem
saída foram comprovados por teste:

| Tentativa | Resultado |
| --- | --- |
| Issuer no domínio do app, discovery em `public/.well-known/*` | `404 Not found` — a hospedagem reserva `/.well-known/` (o `robots.txt` do mesmo `public/` responde 200) |
| Issuer na raiz do host do backend | `404 {"error":"requested path is invalid"}` |
| CNAME apontando para a function | Falha no TLS — o backend não tem certificado para o nosso hostname |

Por isso o conector é publicado na **raiz de um subdomínio nosso**, servido por um
Cloudflare Worker (`infra/cloudflare/mcp-proxy-worker.js`), que atende:

```text
mcp.atendejulia.com.br
├── /.well-known/oauth-authorization-server   discovery (gerado no Worker)
├── /.well-known/oauth-protected-resource     discovery do recurso
├── /authorize                                → copiloto-oauth/authorize (302 p/ consentimento)
├── /token /register /revoke                  → copiloto-oauth/<rota>
└── /  (POST JSON-RPC, SSE)                   → copiloto-mcp
```

Publicação do Worker: instruções no cabeçalho do próprio arquivo. Variável obrigatória:
`BACKEND_FUNCTIONS_BASE` (a base `/functions/v1` do backend).

### Caminho único — OAuth

Não existe chave de acesso estática: a conexão é sempre por OAuth
(descoberta → registro dinâmico → login/consentimento → token, renovável e revogável).
A URL a colar no cliente MCP é:

```text
https://mcp.atendejulia.com.br
```

A tela de consentimento continua em `acesso.atendejulia.com.br/copiloto/consentimento`
(é onde o usuário tem sessão/login). A rota `/authorize` do app
(`src/pages/CopilotoAuthorizeRedirect.tsx`) permanece como atalho compatível.

Alterando o endereço: `MCP_URL` em `src/modules/mvp-copiloto/lib/copilotoApi.ts` e a
variável `COPILOTO_ISSUER` nas functions `copiloto-oauth` e `copiloto-mcp` (padrão
`https://mcp.atendejulia.com.br`).

O escritório é resolvido no servidor no consentimento e gravado no token; o escopo é
somente leitura e a conexão pode ser revogada em `/mvp-copiloto`.


