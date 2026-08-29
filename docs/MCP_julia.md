# Conector MCP da Julia — documentação da implementação

Conector remoto (Model Context Protocol) que expõe os dados do escritório na Julia
para clientes oficiais de IA — OpenClaw, ChatGPT, Claude — usando a assinatura Pro
do próprio usuário. **Somente leitura.**

Rota de gestão no painel: `/mvp-copiloto`.

## Endpoints

| Função | URL | Papel |
| --- | --- | --- |
| `copiloto-mcp` | `https://<projeto>.supabase.co/functions/v1/copiloto-mcp` | Resource Server MCP (JSON-RPC / Streamable HTTP) |
| `copiloto-oauth` | `.../functions/v1/copiloto-oauth` | Authorization Server (OAuth 2.1 + PKCE S256 + DCR) |

Discovery: `/.well-known/oauth-authorization-server` (no OAuth) e
`/.well-known/oauth-protected-resource` (nos dois). Sem Bearer válido, o MCP
responde `401` com `WWW-Authenticate` apontando para o discovery.

Métodos JSON-RPC suportados: `initialize`, `notifications/initialized`, `ping`,
`tools/list`, `tools/call`, `resources/list`, `resources/read`, `prompts/list`,
`prompts/get`.

## Modelo de segurança

- O escopo (`leads:read`, `julia:read`) e o **escritório** ficam gravados no token
  (`cop_oauth_tokens.julia_client_id`), resolvidos no servidor durante o consentimento.
- **Nenhuma tool aceita `client_id`**, SQL ou nome de tabela como argumento. Todo
  filtro de tenant é aplicado no servidor.
- Banco legado é acessado só por `db-query` com SQL literal escrito no servidor e
  valores ligados como parâmetros; o escopo é o conjunto de `cod_agent` do escritório
  (`supabase/functions/_shared/copiloto/legacy.ts`).
- Limites: 100 mensagens por leitura de conversa, 200 registros por listagem,
  truncamento de texto para não estourar a janela do modelo.
- Nenhuma operação de escrita existe no conector. Tokens expiram, são renovados por
  refresh token e podem ser revogados na página do conector.

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
| `julia_chat_listar_conversas` | `status`, `queue_id`, `assigned_user_id`, `busca`, `limite` | protocolo, status, prioridade, canal, responsável, snooze | `chat_conversations` + `chat_contacts` |
| `julia_chat_obter_conversa` | `conversation_id` | dossiê do atendimento (fila, SLA, tags, encerramento, ticket) | `chat_conversations`, `queues`, `chat_conversation_tags` |
| `julia_chat_ler_mensagens` | `conversation_id` ou `contato_id`, `limite` | histórico cronológico com papéis e transcrições | `chat_messages` |
| `julia_chat_listar_arquivos` | `conversation_id` ou `contato_id` | anexos com `message_id` | `chat_messages` |
| `julia_chat_ler_conteudo_arquivo` | `message_id`, `max_paginas` | texto extraído de PDF/TXT/CSV | `chat_messages` + download da mídia |
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
| `julia_equipe_listar` | — | `users` (legado) |
| `julia_agentes_listar` | — | `agents` (legado) |
| `julia_campanhas_listar` | `status`, `limite` | `dsp_campaigns` |
| `julia_telefonia_listar_chamadas` | `contato_id`, `dias`, `limite` | `wavoip_call_logs`, `phone_call_logs` |
| `julia_tickets_listar` | `status`, `limite` | `support_tickets` |
| `julia_tickets_obter` | `ticket_id` | `support_tickets`, `support_ticket_messages` |
| `julia_operacao_indicadores` | `dias` | `chat_conversations` (agregação em memória) |

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

- `public/.well-known/oauth-authorization-server` (+ `.json`) e
  `public/.well-known/oauth-protected-resource` (+ `.json`) — documentos de descoberta
  servidos na raiz do domínio do app. Só ficam ativos após publicar o frontend.
- Rota `/authorize` do app (`src/pages/CopilotoAuthorizeRedirect.tsx`) — repassa a query
  original para `copiloto-oauth/authorize`, que cria o pedido e abre
  `/copiloto/consentimento`.
- `copiloto-oauth` publica `issuer` e `authorization_endpoint` no domínio do app;
  `token`, `register` e `revoke` continuam nas URLs absolutas da function (são POST do
  cliente, não passam pelo app estático).
- `copiloto-mcp` responde 401 com
  `WWW-Authenticate: Bearer resource_metadata="https://acesso.atendejulia.com.br/.well-known/oauth-protected-resource"`.

### Caminho 2 — chave de acesso (Bearer estático)

Para clientes que não concluem o OAuth, `/mvp-copiloto` gera uma **chave de acesso**
(`POST copiloto-oauth/access-key`, exige e-mail e senha da Julia, validade 30/90/365 dias,
`kind = key`). No cliente MCP basta configurar o servidor remoto com:

```text
URL:    https://<backend>/functions/v1/copiloto-mcp
Header: Authorization: Bearer <chave>
```

A chave carrega o escritório resolvido no servidor, é somente leitura, registra
`last_used_at` e pode ser revogada na própria página (exige senha).
