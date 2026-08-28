# X-Julia GPT — Copiloto Jurídico

> **Documento consolidado.** Funde [`integracao-ia-pro-auth.md`](integracao-ia-pro-auth.md) (rotas de sessão, casos de uso jurídicos, UX e biblioteca de prompts) com [`copiloto-juridico.md`](copiloto-juridico.md) (restrições dos fornecedores, núcleo de ferramentas, MCP+OAuth, modelo de dados). Onde os dois divergiam, a divergência foi resolvida com verificação — e está registrada explicitamente na seção 4.
>
> Escopo: dar ao advogado um copiloto que **lê a conversa de cada lead, lê os documentos anexados, e produz relatórios de atendimento, pareceres, análises de viabilidade e peças jurídicas** — usando os melhores modelos disponíveis, com o menor custo possível e sem comprometer sigilo profissional.
>
> Leitura prévia: [`data-handoff.md`](data-handoff.md) (chaves de correlação e dicionário de dados) e [`../CLAUDE.md`](../CLAUDE.md) (postura de segurança).
> Base: análise do código-fonte + verificação das políticas vigentes dos fornecedores, 2026-08.

---

## 1. Sumário executivo

O objetivo é claro: aproveitar **as assinaturas Pro que o escritório já paga** (ChatGPT, Claude, Gemini) em vez de gerar fatura de API por token, e ter isso integrado ao fluxo de atendimento da Julia.

Existem **três rotas técnicas** para chegar lá. Elas não são equivalentes — diferem em legalidade contratual, risco operacional e experiência de uso:

| | **Rota 1 — Conector MCP** | **Rota 2 — Copiloto na Julia** | **Rota 3 — Ponte de sessão** |
|---|---|---|---|
| Usa a assinatura Pro | ✅ Sim | ❌ Não (chave de API do escritório) | ✅ Sim |
| Custo de API para a Julia | Zero | Por token, medido e limitado | Zero |
| Onde a conversa acontece | No ChatGPT/Claude/Gemini | Numa tela da Julia | Numa tela da Julia |
| Suporte oficial do fornecedor | ✅ Oficial | ✅ Oficial | ❌ Proibido nos ToS |
| Automação (lote, agendado) | ❌ Não | ✅ Sim | ⚠️ Tecnicamente sim |
| Risco de banimento da conta | Nenhum | Nenhum | **Alto** — há detecção ativa |
| Adequado a dado sob sigilo | ✅ Com consentimento | ✅ Com DPA do provedor | ❌ Sem contrato de tratamento |

**Recomendação:** implementar **Rota 2 primeiro** (entrega valor imediato, reaproveita quase tudo que já existe no repositório) e **Rota 1 em seguida** (é a que realmente zera o custo de API, de forma oficial). A **Rota 3 está documentada na seção 10 por completude técnica** — porque foi projetada em detalhe e a decisão de usá-la ou não é do dono do produto — mas ela **não é recomendada**, e a seção 4 explica por quê com fontes.

O que é comum às três rotas — o **núcleo de ferramentas jurídicas**, o **compilador de contexto do lead**, a **leitura de documentos**, os **prompts** e a **UI** — é escrito uma única vez e serve a todas.

---

## 2. Objetivos funcionais e casos de uso

### 2.1 O que o copiloto precisa saber fazer

1. **Análise completa da conversa do lead** — todo o histórico de WhatsApp (uazapi/WABA), transcrições de áudio e notas internas da equipe.
2. **Leitura e extração de documentos** — PDFs, fotos de comprovantes, laudos, contratos, certidões anexados na conversa.
3. **Peças jurídicas** — petição inicial, contestação, recurso, réplica, notificação extrajudicial.
4. **Pareceres e viabilidade** — probabilidade de êxito, prescrição/decadência, valor estimado da causa, estratégia.
5. **Relatórios executivos de atendimento** — síntese para o advogado sênior ou para o cliente.

### 2.2 Casos de uso

**CU-1 · Parecer de viabilidade**
Avaliar se o relato do lead tem fundamento fático e jurídico. Saída: síntese dos fatos · enquadramento legal e teses aplicáveis (CLT/CC/CDC, súmulas) · riscos, ônus da prova e documentos faltantes · estimativa de pedidos e valores · recomendação prática.

**CU-2 · Redação de peça**
Peça processual completa: qualificação das partes, fatos, direito, jurisprudência, rol de pedidos com liquidação estimada.

**CU-3 · Auditoria de documentos**
O cliente manda foto de extrato, contrato de consignado ou laudo. A IA extrai: taxas abusivas, inconsistências em rescisão/FGTS, nexo causal em laudo médico.

**CU-4 · Relatório de atendimento**
Síntese executiva pronta para anexar ao card do CRM Builder ou ao Advbox, com situação atual e próximos passos.

> **Regra editorial obrigatória, em todos os casos:** o artefato é **rascunho para revisão de advogado**. O modelo deve distinguir o que é inferência do que veio do documento, e **nunca** inventar número de processo, jurisprudência ou artigo de lei. Alucinação de citação é o risco reputacional mais concreto deste módulo.

---

## 3. Arquitetura: um núcleo, três rotas

```
                     ┌──────────────────────────────────────────────────┐
                     │       NÚCLEO DE FERRAMENTAS JURÍDICAS            │
                     │  _shared/copiloto/tools.ts                       │
                     │                                                  │
                     │  buscar_lead · ler_conversa · resumo_conversa    │
                     │  estado_comercial · listar_documentos            │
                     │  ler_documento · dados_do_caso                   │
                     │  status_contrato · gerar_artefato                │
                     │                                                  │
                     │  + COMPILADOR DE CONTEXTO (seção 6)              │
                     │  + BIBLIOTECA DE PROMPTS (seção 12)              │
                     └──────────────────────────────────────────────────┘
                        ▲                  ▲                    ▲
          ┌─────────────┘                  │                    └──────────────┐
          │                                │                                   │
┌─────────────────────┐      ┌──────────────────────────┐      ┌──────────────────────────┐
│ ROTA 1              │      │ ROTA 2                   │      │ ROTA 3                   │
│ copiloto-mcp        │      │ copiloto-chat            │      │ Extensão / daemon        │
│ + copiloto-oauth    │      │ (guard + streaming)      │      │ (ponte de sessão)        │
│                     │      │                          │      │                          │
│ OAuth 2.1 + PKCE    │      │ requireAppIdentity       │      │ cookies do navegador     │
│ MCP Streamable HTTP │      │ xj_client_provider_keys  │      │ ⚠️ contra ToS (seção 4)  │
│ ✅ oficial          │      │ ✅ oficial               │      │ ❌ não recomendada       │
└─────────────────────┘      └──────────────────────────┘      └──────────────────────────┘
          │                                │                                   │
          ▼                                ▼                                   ▼
 ChatGPT/Claude/Gemini            Tela do Copiloto                  Abas logadas do
 do próprio advogado              dentro da Julia                   navegador do advogado
 (a assinatura dele paga)         (chave do escritório)             (a assinatura dele paga)
          │                                │                                   │
          └────────────────────────────────┴───────────────────────────────────┘
                                           ▼
                    ┌────────────────────────────────────────────┐
                    │  DADOS — sempre filtrados por client_id     │
                    │  chat_messages · chat_conversations         │
                    │  xj_sessions · xj_legal_cases · xj_deals    │
                    │  crm_deals · xj_contracts · Postgres externo│
                    └────────────────────────────────────────────┘
```

**A regra que sustenta tudo:** o `client_id` **nunca** vem do argumento da ferramenta nem do corpo da requisição. Vem do guard (Rota 2), do token OAuth (Rota 1) ou da sessão da Julia (Rota 3) — sempre resolvido no servidor. Isso é obrigatório porque **a RLS deste projeto é permissiva** (`USING (true) WITH CHECK (true)` em praticamente toda tabela): o isolamento entre escritórios é responsabilidade do código, não do banco.

---

## 4. Restrições dos fornecedores — o ponto que decide a rota

Esta seção resolve a divergência entre os dois documentos de origem. O `integracao-ia-pro-auth.md` classificava a ponte de sessão como *"Padrão 1 (Recomendado)"* com *"Zero Risco de Bloqueio"*. **Isso não se sustenta em 2026** — e a diferença importa, porque o preço do erro é a conta do escritório ser banida no meio de um prazo processual.

| Fornecedor | O que a assinatura permite | O que é proibido | Fonte / data |
|---|---|---|---|
| **OpenAI** (ChatGPT Free/Go/Plus/Pro) | *Sign in with ChatGPT* entrega **identidade** (nome, e-mail, foto) + créditos de API. **Apps in ChatGPT / Apps SDK**: seu app roda **dentro** do ChatGPT usando o modelo e os limites do plano do usuário. | Usar a assinatura do usuário para alimentar inferência **no seu próprio produto**. *"Bring your own plan"* segue como pedido de desenvolvedores, não produto lançado. | Apps SDK / App Directory, rollout início de 2026 |
| **Anthropic** (Claude Free/Pro/Max) | **Custom Connectors via MCP remoto** — Free (1 conector), Pro, Max, Team, Enterprise. | OAuth de assinatura é *"exclusivo para o Claude Code e o Claude.ai"*. Usar esses tokens em qualquer outro produto — **incluindo o Agent SDK** — viola os Termos de Consumo. Desenvolvedores **não podem coletar, armazenar ou intermediar credenciais ou tokens de sessão do Claude.ai**. | Política de OAuth / Agent SDK, 2026 |
| **Google** (Gemini) | Extensões / MCP no Gemini. Caminho corporativo: Vertex AI com OAuth do Google. | Padrão de OAuth do Gemini CLI em software de terceiros **banido em fev/2026**, com **detecção ativa desde 25/03/2026**. A assinatura Google AI do usuário não paga chamadas de app de terceiro. | Anúncio de mitigação de abuso, `google-gemini/gemini-cli`, 2026 |

### Por que isso pesa mais aqui do que em outro produto

Julia é SaaS multi-tenant para **escritórios de advocacia**. O dado que trafega é conversa de cliente, documento pessoal, análise de caso — material sob **sigilo profissional** e, na LGPD, majoritariamente **dado pessoal sensível** (saúde em BPC/LOAS; dado de menor em casos de TEA).

Uma conta de consumidor:
- não vem com contrato de tratamento de dados (DPA);
- não dá garantia contratual de não-treinamento equivalente à do plano de API;
- não tem trilha de auditoria exportável;
- e, se **compartilhada entre tenants** (como propõe o padrão de VPS com conta Pro única), mistura dados de escritórios diferentes sob um único login — o oposto do isolamento que o produto promete aos clientes.

**Consequência prática para o desenho:** a Rota 3 continua descrita na seção 10, porque a engenharia foi feita e a decisão é do dono do produto. Mas ela é apresentada pelo que é — uma rota que contraria os ToS dos três fornecedores, com detecção ativa em pelo menos um deles — e não como a opção recomendada.

---

## 5. O núcleo de ferramentas

Arquivo novo: `supabase/functions/_shared/copiloto/tools.ts`. Segue o padrão de `supabase/functions/_shared/x-julia/skills.ts` — array de definições em JSON Schema + dispatcher `switch`.

```ts
// Espelha XJToolDef de _shared/x-julia/llm.ts — o mesmo formato serve para
// tool calling de LLM (Rota 2) e para tools/list do MCP (Rota 1).
export interface CopilotoTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;   // JSON Schema
  scope: 'leads:read' | 'documentos:read' | 'crm:read' | 'artefatos:write';
}

export interface CopilotoCtx {
  supabase: any;
  clientId: string;      // SEMPRE do guard/token — nunca do argumento
  userId: string;
  userName?: string;
}

export const COPILOTO_TOOLS: CopilotoTool[] = [ /* ... */ ];

export async function runCopilotoTool(
  ctx: CopilotoCtx, name: string, args: any,
): Promise<string>;      // devolve texto/markdown, como runXJSkill
```

| Tool | Escopo | O que faz | O que reaproveita |
|---|---|---|---|
| `buscar_lead` | `leads:read` | Localiza o lead por telefone ou nome | `chat_contacts` filtrando `client_id`; telefone **sempre** via `getBrPhoneVariants` (`src/lib/phoneVariants.ts`) — nunca comparação direta de string |
| `ler_conversa` | `leads:read` | Histórico já rotulado por autor | **`loadHistory(supabase, conversationId, contactId, limit, since?)`** de `_shared/x-julia/prompt.ts`. Memória por **contato**. `MAX_HISTORY_CHARS = 60_000`, `MAX_MESSAGE_CHARS = 1200` |
| `resumo_conversa` | `leads:read` | Resumo longo já existente | `chat_conversation_summaries` (`summary`, `atendimento`, `created_at`), últimos 5 por `contact_id` |
| `estado_comercial` | `crm:read` | Situação nos três CRMs | `xj_deals` + `xj_deal_history` · `crm_deals` (via `custom_fields.links`) · `crm_atendimento_cards` + `crm_atendimento_stages` no Postgres externo, via `db-query` |
| `listar_documentos` | `documentos:read` | Todos os arquivos do lead/caso | **Lacuna 1** (seção 7) |
| `ler_documento` | `documentos:read` | Extrai o conteúdo | **`xjResolveMediaBytes`** (`_shared/x-julia/media.ts`) + extração de `_shared/x-julia/documents.ts` |
| `dados_do_caso` | `leads:read` | Ficha do caso jurídico | `xj_legal_cases` + `xj_case_questions` + `xj_case_knowledge` |
| `status_contrato` | `crm:read` | Situação da assinatura | `xj_contracts` e a legada `sing_document` (`status_document` ∈ `CREATED\|SIGNED\|PENDING\|CANCELLED\|DELETED`, `zapsing_doctoken`) — **grafias erradas são os nomes reais** |
| `gerar_artefato` | `artefatos:write` | Persiste relatório / peça / parecer | Grava em `cop_artifacts` (seção 13) |

---

## 6. Compilador de contexto do lead

O que a IA precisa receber para atuar como especialista, e de onde cada pedaço vem.

```
┌────────────────────────────────────────────────────────────────────────┐
│                      COMPILADOR DE CONTEXTO                            │
│                                                                        │
│  1. CADASTRO  →  chat_contacts · crm_atendimento_cards                 │
│     nome, WhatsApp, e-mail, CPF · tags · fase do funil · contrato      │
│                                                                        │
│  2. HISTÓRICO  →  chat_messages (via loadHistory)                      │
│     texto cronológico · transcrição de áudio · notas internas          │
│                                                                        │
│  3. DOCUMENTOS  →  chat_messages.media_url · xj_case_knowledge         │
│     PDFs, laudos, extratos, holerites, contratos ZapSign               │
│                                                                        │
│  4. CASO JURÍDICO  →  xj_legal_cases · _questions · _knowledge         │
│     critérios de qualificação · documentos exigidos · honorários       │
│                                                                        │
│  5. DIRETRIZES DO ESCRITÓRIO                                           │
│     OAB do responsável · foro/comarca · estilo de redação              │
└────────────────────────────────────────────────────────────────────────┘
```

### 6.1 Distinção de autor — regra canônica

Já implementada em `_shared/x-julia/prompt.ts` e **deve ser reaproveitada, não reescrita**. Errar isso faz o modelo confundir o que o lead disse com o que a Julia respondeu — e um parecer construído sobre essa confusão é pior que nenhum parecer:

| Origem | Regra | Vira |
|---|---|---|
| Lead | `from_me = false` | `role: "user"` |
| Atendente humano | `from_me = true` **e** `sender_name` preenchido | `role: "user"`, prefixo `[Atendente {sender_name}]` |
| IA / agente | `from_me = true` **e** `sender_name` vazio | `role: "assistant"` |
| Nota interna | `internal_note = true` | `role: "user"`, prefixo `[Nota interna da equipe — {sender_name}]` — nunca vista pelo lead |

Corpo da mensagem: `metadata.transcription` → `text` → `caption` → `[{type}]`.

### 6.2 Formato entregue ao modelo

Texto limpo, sem poluição de metadado técnico:

```text
=== CONTEXTO DO ATENDIMENTO JURÍDICO ===
CLIENTE: Carlos Eduardo da Silva
TELEFONE: +55 (11) 98765-4321
RAMO DO DIREITO: Trabalhista / Rescisão Indireta
ADVOGADO RESPONSÁVEL: Dr. Marcos Vinicius (OAB/SP 123.456)
DATA DO PRIMEIRO CONTATO: 14/05/2026

=== HISTÓRICO CRONOLÓGICO DA CONVERSA ===
[14/05/2026 14:02] [CLIENTE]: Boa tarde, preciso de ajuda com a empresa onde trabalho.
[14/05/2026 14:03] [JULIA - BOT]: Olá Carlos! Como posso ajudar você hoje?
[14/05/2026 14:05] [CLIENTE] (áudio transcrito): Trabalho há 3 anos como operador de
  máquinas, sem registro em carteira. Desde janeiro não recebo salário em dia e sofri
  um acidente leve no mês passado sem emissão de CAT.
[14/05/2026 14:10] [ADVOGADO (Dr. Marcos)]: Carlos, você possui extratos bancários
  com os depósitos e fotos do local de trabalho?
[14/05/2026 14:12] [CLIENTE] (anexo: extrato_bancario_2026.pdf): Enviei o extrato
  comprovando que os depósitos vinham do CNPJ da empresa.

=== DOCUMENTOS ANEXADOS DISPONÍVEIS ===
1. extrato_bancario_2026.pdf (comprovante de vínculo e depósitos esparsos)
2. foto_atestado_medico.jpeg (primeiros socorros pós-acidente)
```

---

## 7. Leitura de documentos

O motor já existe e é bom — `xjReadInbound` em `_shared/x-julia/documents.ts`:

| Tipo | Como é lido |
|---|---|
| Áudio (`audio`/`ptt`) | `chat-transcribe-audio` (preferencial); fallback multimodal `{ type: "input_audio", input_audio: { data, format } }` |
| Imagem / sticker | `{ type: "image_url", image_url: { url: "data:{mime};base64,…" } }` |
| PDF | `{ type: "file", file: { filename, file_data: "data:…" } }` |
| Planilha / CSV / texto | `npm:xlsx@0.18.5` → CSV. **Máx. 5 abas × 200 linhas**, truncado em 20.000 chars |

Bytes vêm de `xjResolveMediaBytes` (`_shared/x-julia/media.ts`), que resolve os casos difíceis: download obrigatório na uazapi (mídia vem `.enc`), `download_media` na WABA, URL pública como fallback. Teto: `MAX_BASE64_BYTES = 28_000_000` (~21 MB binário).

### As três lacunas a fechar

**Lacuna 1 — não existe varredura multi-documento.** `xjReadInbound` lê **uma** mídia *inbound* por vez, a partir de uma linha de `chat_messages`. "Audite todos os documentos deste lead" não é possível hoje. Implementar em `listar_documentos`:

```sql
-- Nunca sem o filtro de client_id
SELECT id, type, file_name, caption, media_url, timestamp
  FROM chat_messages
 WHERE contact_id = $1
   AND client_id  = $2
   AND type IN ('document', 'image')
 ORDER BY timestamp DESC
 LIMIT 50;
```

`ler_documento` recebe o `id` e chama o pipeline existente. O modelo decide o que abrir — não se lê tudo de uma vez.

**Lacuna 2 — `xj_case_knowledge.file_url` nunca chega ao LLM.** Hoje o agente lê apenas `title` e `content` (truncado em 4.000 chars por item). Um PDF anexado à base de conhecimento do caso é **invisível**. Ligar `file_url`/`file_name`/`mime_type` ao mesmo pipeline.

**Lacuna 3 — não há lugar próprio para documento de caso.** Tudo mora no bucket `chat-media` (não existe `client-files`), indexado por `chat_messages.media_url`. Para o v1 basta; se surgir upload fora do fluxo de mensagem, aí vale um bucket dedicado.

### Política de limites (definir antes de codar)

- Máx. de documentos abertos por pergunta (sugestão: 5) — evita estourar contexto e custo.
- Truncamento por documento, com aviso explícito ao modelo quando houve corte.
- Cache do texto extraído — o mesmo PDF não deve ser re-extraído a cada pergunta.

---

## 8. Rota 1 — Conector MCP + OAuth 2.1

**É a rota que realmente atende ao pedido original** (usar a assinatura Pro, sem custo de API) de forma oficial. A inversão é o truque: em vez de a Julia chamar o ChatGPT do advogado, **a Julia vira uma ferramenta que o ChatGPT dele consome**.

### 8.1 O que se constrói

Duas edge functions novas. **Ambas precisam de `verify_jwt = false`** em `supabase/config.toml` — são chamadas por ChatGPT/Claude/Gemini, que não têm a anon key do projeto:

```toml
[functions.copiloto-oauth]
verify_jwt = false

[functions.copiloto-mcp]
verify_jwt = false
```

> No resto do projeto, funções de painel **não** entram no `config.toml` (herdam `verify_jwt = true`, satisfeito pela anon key, com a identidade real vindo do guard). Estas duas são a exceção legítima — e por isso carregam a própria autenticação (OAuth), não ficam abertas.

| Função | Responsabilidade |
|---|---|
| `copiloto-oauth` | Authorization server: descoberta, `/authorize`, `/token`, registro dinâmico, revogação |
| `copiloto-mcp` | Resource server: transporte MCP (Streamable HTTP), `initialize`, `tools/list`, `tools/call` → `runCopilotoTool` |

### 8.2 Descoberta (`.well-known`)

O MCP exige metadados em caminhos `.well-known` **na raiz do host**, não sob `/functions/v1/...`. Como o app já tem domínio próprio (`XJ_PUBLIC_APP_URL`, hoje `https://acesso.atendejulia.com.br`), servir os dois documentos a partir do domínio da aplicação com *rewrite* para a edge function:

| Caminho público | Conteúdo | RFC |
|---|---|---|
| `/.well-known/oauth-protected-resource` | `resource`, `authorization_servers[]`, `scopes_supported[]` | RFC 9728 |
| `/.well-known/oauth-authorization-server` | `issuer`, `authorization_endpoint`, `token_endpoint`, `registration_endpoint`, `code_challenge_methods_supported: ["S256"]` | RFC 8414 |

```jsonc
// /.well-known/oauth-protected-resource
{
  "resource": "https://acesso.atendejulia.com.br/mcp",
  "authorization_servers": ["https://acesso.atendejulia.com.br"],
  "scopes_supported": ["leads:read", "documentos:read", "crm:read", "artefatos:write"],
  "bearer_methods_supported": ["header"]
}
```

### 8.3 Fluxo de autorização

**OAuth 2.1 com PKCE `S256` obrigatório.** Cliente público no ChatGPT (sem secret); o Claude aceita Client ID/Secret pré-registrados.

```
Advogado, no Claude:  Settings → Connectors → Add custom connector
                      URL: https://acesso.atendejulia.com.br/mcp
   │
   ├─1─▶ Cliente busca /.well-known/oauth-protected-resource
   │     e /.well-known/oauth-authorization-server
   │
   ├─2─▶ (opcional) POST /register → registro dinâmico (RFC 7591)
   │
   ├─3─▶ Abre /authorize?response_type=code&client_id=…
   │            &code_challenge=…&code_challenge_method=S256
   │            &redirect_uri=…&scope=leads:read+documentos:read&state=…
   │
   │     ┌──────────────────────────────────────────────────┐
   │     │  Tela de consentimento da Julia                  │
   │     │  • Login pelo AuthContext existente (bcrypt)     │
   │     │  • Mostra: escritório resolvido + escopos        │
   │     │  • "Autorizar Claude a acessar estes dados"      │
   │     └──────────────────────────────────────────────────┘
   │
   ├─4─▶ Redirect ?code=…&state=…   (cop_oauth_codes, TTL 60s, uso único)
   │
   ├─5─▶ POST /token { grant_type: authorization_code, code, code_verifier }
   │     → { access_token, refresh_token, expires_in, scope }
   │        vinculados a user_id + client_id resolvidos NO SERVIDOR
   │
   └─6─▶ POST /mcp  Authorization: Bearer <access_token>
         → initialize / tools/list / tools/call
```

**O ponto crítico de segurança:** no passo 3 a Julia resolve `client_id` a partir do usuário logado — a mesma regra do guard, `COALESCE(u.client_id, parent.client_id)`. O token carrega esse `client_id`. Nenhuma ferramenta aceita `client_id` como argumento. Um token do escritório 402 é fisicamente incapaz de ler dados do escritório 517.

### 8.4 Transporte MCP

`POST /mcp`, JSON-RPC 2.0, resposta em JSON ou SSE conforme o `Accept`:

| Método | Resposta |
|---|---|
| `initialize` | `protocolVersion`, `capabilities: { tools: {} }`, `serverInfo` |
| `tools/list` | `COPILOTO_TOOLS` filtrado pelos escopos do token |
| `tools/call` | `runCopilotoTool(ctx, name, args)` → `{ content: [{ type: "text", text }] }` |

Token inválido/ausente → **401 com header `WWW-Authenticate`** apontando o `resource_metadata` — é o que dispara o fluxo de OAuth automaticamente no cliente.

### 8.5 Como o advogado conecta

| Provedor | Caminho | Observações |
|---|---|---|
| **Claude** (Pro/Max/Team/Enterprise; Free = 1 conector) | *Settings → Connectors → Add custom connector* → URL do MCP; Client ID/Secret em *Advanced settings* | O mais direto — não exige aprovação prévia |
| **ChatGPT** (Free/Go/Plus/Pro) | Apps SDK / App Directory | OAuth 2.1 + PKCE S256; cliente via **CIMD** (`client_id` = URL de um documento de metadados), DCR ou pré-registro. Permite **renderizar componentes da Julia dentro do ChatGPT**. Passa por revisão da OpenAI |
| **Gemini** | Extensões MCP | Mesmo servidor; validar suporte a OAuth na versão vigente |

### 8.6 Tela "Conexões de IA"

Necessária para governança: tokens ativos do usuário (provedor, escopos, criado em, `last_used_at`), botão **revogar**, e — para o admin do escritório — visão de todas as conexões do tenant.

---

## 9. Rota 2 — Copiloto dentro da Julia

O chat na interface da Julia. **É o trilho que entrega valor primeiro**, porque quase tudo já existe no repositório.

### 9.1 Módulo

`src/modules/copiloto/`, no padrão isolado do `x-julia` (regra do `module.ts` de lá: *"nada fora do módulo importa daqui, e tudo que vem de outros módulos passa por `extend/`"*):

```
src/modules/copiloto/
  module.ts                    ← metadados, menu items (= linhas da matriz de permissões), rotas
  extend/
    db.ts, auth.ts, chat.ts    ← única fronteira com o resto do app
    useEnsureCopilotoModule.ts ← auto-registro idempotente na tabela `modules`
  lib/copilotoInvoke.ts        ← headers de identidade (espelha xjInvoke)
  hooks/, components/, pages/
```

Rota em `src/App.tsx`: `lazy()` + `<ProtectedRoute module="copiloto">`.

### 9.2 Edge function `copiloto-chat`

```ts
import { requireAppIdentity, XJ_GUARD_HEADERS, xjGuardFailed } from "../_shared/x-julia/guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": XJ_GUARD_HEADERS,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const identity = await requireAppIdentity(req);
  if (xjGuardFailed(identity)) return json({ error: identity.error }, identity.status);

  // identity.clientId veio do servidor. É ele que vai no CopilotoCtx.
});
```

Encadeamento por turno:

1. `checkUsageBreach(supabase, clientId, threadId)` — disjuntor de custo, antes de qualquer chamada (`_shared/x-julia/limits.ts`).
2. System prompt em camadas, no espírito de `buildXJMessages` — mas com persona de **assistente jurídico do escritório**, não de recepcionista de WhatsApp.
3. Chama o modelo com `COPILOTO_TOOLS`, em streaming.
4. Executa tool calls via `runCopilotoTool`, devolve resultados e continua (loop com teto, como `MAX_TOOL_ROUNDS = 6`).
5. `estimateCost(...)` + `logXJEvent(...)` + `bumpUsage(...)`.

### 9.3 Streaming — reaproveitar o padrão que já funciona

`xjComplete()` (`_shared/x-julia/llm.ts`) **não faz streaming**. Mas `supabase/functions/copilot-chat/index.ts` já tem o padrão certo:

```ts
// Um ramo vai ao cliente; o outro é "sniffado" para capturar usage sem bloquear.
const [clientStream, sniffStream] = aiResponse.body!.tee();

(async () => { /* lê sniffStream, parseia "data:", extrai obj.usage, loga custo */ })();

return new Response(clientStream, {
  headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
});
```

**Não duplicar a resolução de chaves.** Criar `copilotoStream()` reusando `resolveKey()` e `XJ_PROVIDERS` de `_shared/x-julia/llm.ts`, apenas acrescentando `stream: true`. Assim herda de graça: os 8 provedores, a chave por escritório (`xj_client_provider_keys`, `kind='llm'`), o fallback e os *quirks* de modelo já mapeados (ex.: família GPT-5 recusa `temperature`).

⚠️ **Não replicar os defeitos da `copilot-chat` legada**: aceita `userId` no corpo sem validar header (IDOR — qualquer um com a anon key lê o CRM de outro usuário), não tem `client_id`/multi-tenancy, não tem tool calling.

### 9.4 Persistência

`cop_threads` e `cop_messages` (seção 15). A legada `crm_copilot_chat_messages` **não serve**: só tem `user_id`, sem `client_id`.

---

## 10. Rota 3 — Ponte de sessão (documentada, não recomendada)

> ⚠️ **Status:** contraria os Termos de Uso dos três fornecedores (seção 4). Anthropic proíbe explicitamente intermediar tokens de sessão do Claude.ai; Google mantém **detecção ativa desde 25/03/2026**. Além do risco de banimento da conta do escritório, não há contrato de tratamento de dados — o que é problema direto de sigilo profissional e LGPD.
>
> Está aqui porque a engenharia foi feita em detalhe e a decisão é do dono do produto. **Se for adotada, que seja com consciência do custo, não por acreditar que é "zero risco".**

### 10.1 Os três padrões

**Padrão A — Extensão de navegador ("Julia AI Companion").** O advogado instala a extensão, mantém as abas do ChatGPT/Claude/Gemini logadas, e a extensão executa a requisição dentro da sessão ativa, devolvendo o streaming à interface da Julia via `postMessage`. Usa o IP e o *fingerprint* reais do navegador. Nenhuma senha ou cookie chega ao banco da Julia. É o menos ruim dos três — mas continua sendo uso de sessão de consumidor por software de terceiro.

**Padrão B — Desktop bridge / sidecar local.** Serviço local (`localhost:57218`) com navegador headless e perfil persistente; a Julia chama via HTTP/WebSocket. Suporta fila de análise em lote.

**Padrão C — Docker headless / VPS compartilhado.** Contêiner com Playwright, login único via VNC, expondo endpoint interno. **É o pior dos três em conformidade:** uma conta Pro compartilhada entre vários advogados — e potencialmente vários tenants — mistura dados de escritórios sob um único login, contrariando frontalmente o isolamento que o produto promete.

### 10.2 Referência técnica por provedor

Mantida para completude. Endpoints internos não são versionados nem documentados publicamente — **mudam sem aviso e quebram a integração**, o que é um custo de manutenção permanente a considerar.

| | **ChatGPT** (`chatgpt.com`) | **Claude** (`claude.ai`) | **Gemini** (`gemini.google.com`) |
|---|---|---|---|
| Sessão | Cookie `__Secure-next-auth.session-token` + Bearer efêmero | Cookie `sessionKey` (`sk-ant-sid01-…`) | `__Secure-1PSID`, `__Secure-1PSIDTS`, `__Secure-1PSIDCC`, `SSID` |
| Obter token | `GET /api/auth/session` (~1h de validade) | `GET /api/organizations` → `org_id` | Token `SNlM0e` do `window.WIZ_global_data` |
| Conversação | `POST /backend-api/conversation` | `POST /api/organizations/{org_id}/chat_conversations/{chat_id}/completion` | `POST /_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate` |
| Upload | `POST /backend-api/files` → `file_id` | `POST /api/organizations/{org_id}/upload` | — |

### 10.3 Comunicação extensão ↔ front

O contrato de mensageria é a parte reaproveitável desta rota — vale mesmo que a execução mude:

```typescript
// src/hooks/useJuliaAICompanion.ts
export interface CompanionStatus {
  isInstalled: boolean;
  chatgpt: { loggedIn: boolean; plan: 'free' | 'plus' | 'pro' | 'unknown' };
  claude:  { loggedIn: boolean; plan: 'free' | 'pro' | 'team' | 'unknown' };
  gemini:  { loggedIn: boolean; plan: 'free' | 'advanced' | 'unknown' };
}

const executePrompt = async (params: {
  provider: 'chatgpt' | 'claude' | 'gemini';
  model?: string;
  prompt: string;
  attachments?: Array<{ url: string; name: string; type: string }>;
  onChunk: (chunk: string) => void;
}): Promise<string> => {
  // postMessage { source: 'JULIA_WEB_APP', type: 'EXECUTE_PROMPT', requestId, payload }
  // escuta   { source: 'JULIA_COMPANION_RESPONSE', type: 'STREAM_CHUNK' | 'STREAM_COMPLETE' | 'ERROR' }
};
```

Manifesto MV3 com `host_permissions` para o domínio da Julia + os três provedores, `content_scripts` apenas na origem da Julia, e `background.service_worker`.

> Se esta rota for adotada, o **Padrão A é o único defensável** (a sessão nunca sai da máquina do advogado, é a conta dele, para os dados do escritório dele). Os padrões B e C acumulam risco sem ganho proporcional.

---

## 11. Interface e UX

### 11.1 Onde entra na tela

**1. Nova aba no painel direito do chat.** `src/components/chat/ChatRightBar.tsx` hoje tem quatro abas — o tipo é literalmente:

```ts
type RightBarTabId = 'contact' | 'crm' | 'lead' | 'phone';
```

Basta acrescentar `'copiloto'` e o painel `src/components/chat/CopilotoPanel.tsx`. É uma mudança pequena e contida.

**2. Menu de ações rápidas no header** (`src/components/chat/ChatHeader.tsx`), com dropdown:
📋 Resumir atendimento · ⚖️ Parecer de viabilidade · 📝 Gerar petição · 📑 Auditar documentos · 💬 Chat livre

**3. Modal de peça com exportação** (`LegalDocumentModal.tsx`): markdown renderizado, e os botões *Copiar* · *Baixar .DOCX/.PDF* · *Salvar como nota interna* · *Vincular ao deal do CRM*.

**4. Atalho no CRM** — `src/pages/crm/components/CRMLeadDetailsDialog.tsx`.

### 11.2 Painel do copiloto

```
┌────────────────────────────────────────────────────────┐
│  ⚖️  COPILOTO JURÍDICO                                  │
│                                                        │
│  Modelo:  [ ● Claude (conector)                  ▼ ]   │
│  Status:  Conectado · assinatura do escritório         │
├────────────────────────────────────────────────────────┤
│  AÇÕES COM ESTE LEAD:                                  │
│  [ ⚖️ Parecer ]  [ 📝 Petição ]  [ 🔍 Auditar docs ]    │
├────────────────────────────────────────────────────────┤
│  INSTRUÇÃO:                                            │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Ex.: "Redija notificação extrajudicial ao        │  │
│  │ empregador com prazo de 5 dias..."               │  │
│  └──────────────────────────────────────────────────┘  │
│  [x] Incluir histórico do WhatsApp (38 mensagens)      │
│  [x] Anexar 2 documentos recebidos do cliente          │
│                                                        │
│  [              GERAR DOCUMENTO              ]         │
└────────────────────────────────────────────────────────┘
```

### 11.3 O que copiar de onde

| Necessidade | Origem |
|---|---|
| Parser SSE com recuperação de chunk parcial | `src/components/copilot/CopilotChatTab.tsx` (~104-140) — em `JSON.parse` falho, **recoloca a linha no buffer** |
| Markdown | `src/components/notifications/NotificationCenter.tsx` — `<ReactMarkdown remarkPlugins={[remarkGfm]}>`. **Usar esta**, não a versão do `CopilotChatTab`, que está sem GFM (tabelas não renderizam). `react-markdown@^10.1.0` e `remark-gfm@^4.0.1` já instalados |
| Anexo de arquivo | Padrão `fileInputRef` + `pendingMedia` de `src/components/chat/ChatInput.tsx` — extrair só o padrão, o componente é muito acoplado ao WhatsApp |
| Áudio | `src/components/chat/AudioRecorder.tsx` — `{ onSend, onCancel }` |
| Layout de módulo | `src/modules/x-julia/components/XJLayout.tsx` |

---

## 12. Biblioteca de prompts jurídicos

Ficam em `cop_artifact_templates` (por `client_id`, com fallback global), editáveis pelo escritório — mesmo espírito de `xj_agents.contract_template` e `generation_prompt_config`.

### 12.1 Parecer / análise de viabilidade

```markdown
Você é um consultor jurídico sênior especializado em Direito [ÁREA_DO_DIREITO].
Analise a conversa de atendimento e os documentos do lead abaixo.

Gere um Parecer Jurídico de Viabilidade estruturado rigorosamente em:
1. IDENTIFICAÇÃO DO CASO E PARTES
2. SÍNTESE FÁTICA DETALHADA (extraída da conversa e dos documentos)
3. ENQUADRAMENTO JURÍDICO E FUNDAMENTAÇÃO (artigos e jurisprudência dominante)
4. ANÁLISE DE VIABILIDADE E RISCOS (prescrição, decadência, ônus probatório, pontos frágeis)
5. ESTIMATIVA DE PEDIDOS E VALORES VIÁVEIS
6. PRÓXIMOS PASSOS E DOCUMENTAÇÃO COMPLEMENTAR NECESSÁRIA

Regras invioláveis:
- Distinga o que é FATO EXTRAÍDO do que é INFERÊNCIA SUA.
- Não cite lei, súmula ou julgado de que não tenha certeza. Na dúvida, escreva
  "verificar jurisprudência aplicável" em vez de inventar a citação.
- Aponte explicitamente o que falta para fechar a tese.

Histórico do Atendimento:
[HISTORICO_FORMATADO]
```

### 12.2 Petição inicial

```markdown
Você é um advogado especialista em redação processual.
Com base no histórico fático e nos documentos, redija a PETIÇÃO INICIAL.

Requisitos:
- Endereçamento ao juízo competente da comarca aplicável
- Qualificação das partes, com [MARCADOR] explícito para todo dado ausente
- Dos Fatos, em ordem cronológica
- Do Direito, com tópico individualizado por pedido
- Da Tutela de Urgência (somente se houver elementos fáticos que a sustentem)
- Da Gratuidade da Justiça
- Do Pedido, com liquidação estimada, valor da causa e data

Regras invioláveis:
- NUNCA invente número de processo, precedente ou dispositivo legal.
- Todo dado que não estiver no histórico vira [MARCADOR: descrição], nunca um valor fictício.
- Esta peça é RASCUNHO para revisão do advogado responsável.

Dados do Atendimento e Documentos:
[HISTORICO_FORMATADO]
```

---

## 13. Artefatos e exportação

Todo resultado vira linha em `cop_artifacts`, com versionamento — parecer é revisado várias vezes.

| Tipo | Entrada típica | Esqueleto |
|---|---|---|
| `relatorio_atendimento` | conversa + CRM + contrato | Resumo · Linha do tempo · Qualificação · Pendências · Próximo passo |
| `analise_caso` | conversa + documentos + ficha do caso | Fatos · Documentos apresentados e faltantes · Enquadramento · Riscos · Viabilidade |
| `parecer` | análise + base de conhecimento | Consulta · Fatos · Fundamentação · Conclusão |
| `peca` | análise + modelo do escritório | Conforme o template |

**Exportação:** o repositório já tem o pipeline markdown → HTML → PDF usado em `Julia-Relatorio-Tecnico.pdf` e `docs/Julia-Dossie-Dados.pdf` (conversor próprio + Edge headless com `--print-to-pdf`). Reaproveitar com CSS de impressão — **não** imprimir HTML de tela. Para `.DOCX`, avaliar conversão a partir do mesmo markdown.

---

## 14. Segurança, LGPD e sigilo profissional

### 14.1 Por rota

| | Rota 1 (MCP) | Rota 2 (Copiloto) | Rota 3 (Sessão) |
|---|---|---|---|
| Para onde o dado vai | Conta de chat **do próprio advogado** | Provedor configurado pelo escritório | Conta de chat do advogado, via automação |
| Base do tratamento | Consentimento explícito no `/authorize`, registrado | Contrato do escritório com o provedor | **Nenhuma** — sem DPA |
| Controle | Escopo por token, revogável | Chave do escritório, revogável | Cookie de sessão do navegador |
| Risco | Advogado conectar conta pessoal compartilhada | Chave mal configurada | **Banimento + exposição sem contrato** |

### 14.2 Controles obrigatórios (todas as rotas)

1. **`client_id` sempre do servidor** — do guard, do token ou da sessão. Nenhuma tool aceita `client_id` como argumento. Toda query filtra explicitamente: **a RLS é permissiva e não protege**.
2. **Escopo mínimo** — token com `leads:read` não lê documento.
3. **Trilha de auditoria** em `cop_access_log`: quem, qual lead/caso, qual ferramenta, quando, por qual rota. É o que responde a uma pergunta de cliente ou de auditoria da OAB.
4. **Consentimento registrado** (Rota 1): usuário, provedor, escopos, data, IP.
5. **Anonimização opcional de PII** antes do envio (CPF, RG, endereço), configurável por escritório.
6. **Aviso na interface** de que o artefato é rascunho sujeito a revisão profissional.
7. **Armazenamento interno** — a peça gerada é rascunho em `cop_artifacts` no Supabase do escritório, nunca exposta externamente.

### 14.3 Rate limits das contas Pro (relevante nas Rotas 1 e 3)

Assinaturas têm teto por janela de tempo, e os modelos de raciocínio são os mais restritos. Mitigações:
- **Resumir antes de enviar** conversas com mais de ~500 mensagens (usar `chat_conversation_summaries`, que já existe).
- **Enviar PDF pelo upload nativo** em vez de colar texto bruto de centenas de páginas — economiza janela de contexto e preserva o OCR do provedor.
- Na Rota 2, o disjuntor de custo (`checkUsageBreach` / `xj_usage_limits`) já cobre o equivalente.

### 14.4 Contexto herdado

Este módulo nasce num sistema onde a RLS é permissiva, o `db-query` expõe SQL arbitrário e 40+ funções têm `verify_jwt=false` (ver [`../CLAUDE.md`](../CLAUDE.md)). O Copiloto **não piora** isso, mas amplifica o impacto de qualquer falha de isolamento — porque o dado sai do banco em linguagem natural, já resumido e pronto para leitura. Daí o rigor no item 1.

---

## 15. Modelo de dados

Padrão do projeto: RLS permissiva como o resto + `client_id` obrigatório e filtrado no código. A trigger `xj_touch_updated_at()` já existe e é reaproveitada.

```sql
-- ============ Rota 2: conversas do copiloto ============
CREATE TABLE public.cop_threads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   text NOT NULL,
  user_id     text NOT NULL,
  title       text,
  contact_id  uuid,                 -- lead em foco (opcional)
  case_id     uuid REFERENCES public.xj_legal_cases(id) ON DELETE SET NULL,
  is_archived boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cop_threads_client_user ON public.cop_threads(client_id, user_id, updated_at DESC);

CREATE TABLE public.cop_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  text NOT NULL,
  thread_id  uuid NOT NULL REFERENCES public.cop_threads(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('user','assistant','tool')),
  content    text,
  tool_name  text,
  tool_args  jsonb,
  provider   text,
  model      text,
  prompt_tokens     integer,
  completion_tokens integer,
  cost_usd   numeric(12,6),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cop_messages_thread ON public.cop_messages(thread_id, created_at);

-- ============ Artefatos ============
CREATE TABLE public.cop_artifacts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   text NOT NULL,
  thread_id   uuid REFERENCES public.cop_threads(id) ON DELETE SET NULL,
  contact_id  uuid,
  case_id     uuid REFERENCES public.xj_legal_cases(id) ON DELETE SET NULL,
  tipo        text NOT NULL CHECK (tipo IN ('relatorio_atendimento','analise_caso','parecer','peca')),
  titulo      text NOT NULL,
  conteudo_md text NOT NULL,
  version     integer NOT NULL DEFAULT 1,
  parent_id   uuid REFERENCES public.cop_artifacts(id) ON DELETE SET NULL,
  provider    text, model text, cost_usd numeric(12,6),
  created_by  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cop_artifacts_client ON public.cop_artifacts(client_id, created_at DESC);

CREATE TABLE public.cop_artifact_templates (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  text,                  -- NULL = template global de fallback
  tipo       text NOT NULL,
  nome       text NOT NULL,
  prompt     text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============ Rota 1: OAuth ============
CREATE TABLE public.cop_oauth_clients (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_key     text NOT NULL UNIQUE,     -- client_id OAuth
  client_secret  text,                      -- NULL para cliente público (PKCE)
  name           text NOT NULL,             -- "Claude", "ChatGPT"
  redirect_uris  jsonb NOT NULL DEFAULT '[]',
  is_dynamic     boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cop_oauth_codes (
  code           text PRIMARY KEY,
  client_key     text NOT NULL,
  app_user_id    text NOT NULL,
  app_client_id  text NOT NULL,             -- escritório resolvido no servidor
  scopes         jsonb NOT NULL DEFAULT '[]',
  code_challenge text NOT NULL,             -- PKCE S256
  redirect_uri   text NOT NULL,
  expires_at     timestamptz NOT NULL,      -- TTL curto (60s)
  used_at        timestamptz,               -- uso único
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cop_oauth_tokens (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token_hash  text NOT NULL UNIQUE,  -- guardar HASH, nunca o token
  refresh_token_hash text UNIQUE,
  client_key         text NOT NULL,
  app_user_id        text NOT NULL,
  app_client_id      text NOT NULL,
  scopes             jsonb NOT NULL DEFAULT '[]',
  expires_at         timestamptz NOT NULL,
  revoked_at         timestamptz,
  last_used_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cop_oauth_tokens_user ON public.cop_oauth_tokens(app_user_id) WHERE revoked_at IS NULL;

-- ============ Auditoria ============
CREATE TABLE public.cop_access_log (
  id          bigserial PRIMARY KEY,
  client_id   text NOT NULL,
  user_id     text NOT NULL,
  rota        text NOT NULL CHECK (rota IN ('mcp','copiloto','ponte')),
  tool        text NOT NULL,
  contact_id  uuid,
  case_id     uuid,
  detail      jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cop_access_log_client ON public.cop_access_log(client_id, created_at DESC);
```

Para cada tabela, seguir o padrão do módulo: `GRANT ALL ... TO service_role`, `ENABLE ROW LEVEL SECURITY`, policy `FOR ALL USING (true) WITH CHECK (true)`, e trigger `BEFORE UPDATE ... EXECUTE FUNCTION public.xj_touch_updated_at()`.

---

## 16. Roadmap

| Fase | Escopo | Depende de |
|---|---|---|
| **0 — Núcleo** | `_shared/copiloto/tools.ts` com as 9 ferramentas · compilador de contexto · fechar lacunas 1 e 2 · migration das tabelas `cop_*` | — |
| **1 — Rota 2** | `copiloto-chat` (guard + streaming + tool calling) · módulo `src/modules/copiloto/` · aba `'copiloto'` no `ChatRightBar` · custo e disjuntor | Fase 0 |
| **2 — Prompts e artefatos** | Biblioteca de prompts · `cop_artifacts` com versionamento · modal de peça · exportação PDF/DOCX | Fase 1 |
| **3 — Rota 1** | `copiloto-oauth` + `copiloto-mcp` · `.well-known` no domínio da app · tela de consentimento · "Conexões de IA" · conectar Claude → ChatGPT → Gemini | Fase 0 |
| **4 — (opcional) Rota 3** | Extensão MV3, apenas Padrão A, **se e somente se** a decisão de risco da seção 4 for tomada explicitamente | Fase 2 |

Ordem escolhida assim porque a Fase 1 entrega valor sem depender de aprovação de terceiros e valida o núcleo antes de expô-lo publicamente na Fase 3.

---

## 17. Verificação / aceite

**Fase 0**
- [ ] `listar_documentos` devolve os documentos de um lead real e **nenhum** de outro escritório (testar com dois `client_id`).
- [ ] `ler_documento` extrai texto de um PDF vindo da uazapi (caminho `.enc`) e de um da WABA.
- [ ] Um PDF em `xj_case_knowledge` passa a ser legível pelo modelo.
- [ ] O compilador rotula corretamente lead / atendente / IA / nota interna.

**Fase 1**
- [ ] Chamada sem os headers `x-app-user-id` / `x-app-user-email` → **401**.
- [ ] "Resuma o atendimento do lead X" com resposta em streaming.
- [ ] Custo do turno em `cop_messages.cost_usd`; trilha em `xj_session_events`.
- [ ] Com `xj_usage_limits` estourado, o disjuntor bloqueia.

**Fase 2**
- [ ] Gerar parecer, revisar, salvar v2, e ver as duas versões.
- [ ] Peça gerada não contém citação inventada (revisão manual de 5 amostras).
- [ ] Exportar em PDF com paginação correta.

**Fase 3**
- [ ] `/.well-known/oauth-protected-resource` e `/.well-known/oauth-authorization-server` respondem no domínio da app.
- [ ] Conectar no Claude via *Add custom connector*, autorizar, e pedir "resuma o atendimento do lead X" — resposta correta, **sem consumir API da Julia**.
- [ ] Token sem `documentos:read` → `ler_documento` recusa.
- [ ] Revogar em "Conexões de IA" → próxima chamada retorna 401.
- [ ] Code reusado → recusado; PKCE ausente → recusado.

---

## Notas de manutenção (achados durante a análise)

- **Bug de rollup de custo:** `xj_analytics_daily` soma `xj_session_events.cost`, mas o runner grava em `xj_session_events.cost_usd` (as duas colunas existem). O custo por evento provavelmente aparece **zerado** no analítico. O disjuntor não é afetado (usa `xj_usage_counters`).
- **IDOR na `copilot-chat` legada:** recebe `userId` no corpo sem validar header. Corrigir aplicando `requireAppIdentity`.
- **Duas cópias do módulo de chat** convivem: `src/components/chat/` e `src/modules/julia-chat/chat/`. Alteração em componente de chat precisa considerar as duas.
- **Modelos citados envelhecem rápido.** Este documento evita fixar nomes de modelo de assinatura; o catálogo vivo do projeto está em `XJ_LLM_PROVIDERS` (`src/modules/x-julia/module.ts`) e `XJ_MODEL_CATALOG` (`_shared/x-julia/pricing.ts`).
- **Grafias erradas são os nomes reais** e não devem ser "corrigidas": `sing_document`, `zapsing_doctoken`, `campaing_ads`, `agents_plan.satus`, e a view `"vw_list_client-agents-users"` (com hífen, exige aspas duplas).

---

## Documentos de origem

Este documento substitui, para efeito de decisão:
- [`integracao-ia-pro-auth.md`](integracao-ia-pro-auth.md) — origem das seções 2, 6.2, 10, 11, 12 e 14.3.
- [`copiloto-juridico.md`](copiloto-juridico.md) — origem das seções 4, 5, 7, 8, 9, 13, 15 e 16.
