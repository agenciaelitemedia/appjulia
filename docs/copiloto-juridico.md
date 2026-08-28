# Copiloto Jurídico — integração de IA com contas de chat (ChatGPT / Claude / Gemini)

> Documento de arquitetura. Descreve **como integrar a Julia a modelos de IA** para que um advogado possa analisar a conversa de cada lead, ler documentos e gerar relatórios de atendimento, peças e pareceres.
> Escrito em 2026-08 a partir de análise do código-fonte atual + verificação das políticas vigentes dos três fornecedores.
> Pré-requisito de leitura: [`data-handoff.md`](data-handoff.md) (chaves de correlação e dicionário de dados) e [`../CLAUDE.md`](../CLAUDE.md) (postura de segurança).

---

## 1. Sumário executivo

O pedido original era: *"usar uma conta comum de chat (ChatGPT Pro, Claude Pro, Gemini) via OAuth, sem API, e ter um chat dentro da Julia"*.

**A primeira metade não é possível** — e não por limitação técnica nossa, mas por decisão explícita dos três fornecedores, todas de 2026 (detalhe e fontes na seção 2). Anthropic e Google não só proíbem como **detectam e banem**. Para um SaaS de advocacia há um agravante que pesa mais que o banimento: conta pessoal de consumidor não tem contrato de tratamento de dados nem garantia contratual de não-treinamento — mandar dados de cliente por ali é problema de **sigilo profissional e LGPD**, não só de Termos de Uso.

**A segunda metade é possível, e há um caminho oficial que atende o espírito do pedido** (usar a assinatura que o escritório já paga, sem custo de API): **inverter o sentido da integração**. Em vez de a Julia chamar o ChatGPT do advogado, **a Julia vira uma ferramenta que o ChatGPT/Claude/Gemini do advogado consome**, via **servidor MCP remoto com OAuth 2.1 + PKCE**. Isso é suportado oficialmente pelos três, a inferência roda na assinatura dele, e o custo de API para a Julia é zero.

**Arquitetura recomendada — um núcleo, dois trilhos:**

| | **Trilho A — Conector MCP** | **Trilho B — Copiloto na Julia** |
|---|---|---|
| Onde a conversa acontece | No ChatGPT / Claude / Gemini do advogado | Em uma tela dentro da Julia |
| Quem paga a inferência | A assinatura pessoal/do escritório | O escritório, via chave em `xj_client_provider_keys` |
| Autenticação | OAuth 2.1 + PKCE (do zero) | Guard de sessão já existente |
| Custo de API para a Julia | Zero | Por token, já medido e limitado |
| Automação (relatório agendado, lote) | Não | Sim |

Os dois trilhos chamam **exatamente as mesmas ferramentas** (`buscar_lead`, `ler_conversa`, `ler_documento`, `gerar_artefato`…). O núcleo é escrito uma vez.

**Recomendação de execução:** começar pelo **Trilho B** (entrega valor sem depender de aprovação de terceiros e reaproveita quase tudo que já existe), depois o **Trilho A**. Roadmap na seção 11.

---

## 2. A restrição dos fornecedores

O que cada plano de assinatura permite hoje, para um produto de terceiro como a Julia:

| Fornecedor | O que a assinatura de chat permite | O que é explicitamente proibido | Fonte / data |
|---|---|---|---|
| **OpenAI (ChatGPT Free/Go/Plus/Pro)** | *"Sign in with ChatGPT"* entrega **identidade** (nome, e-mail, foto) e créditos de API como incentivo. **Apps in ChatGPT / Apps SDK**: seu app roda **dentro** do ChatGPT, usando o modelo e os limites do plano do usuário. | Usar a assinatura do usuário para alimentar inferência **no seu próprio produto**. *"Bring your own plan"* segue como pedido de desenvolvedores, não produto lançado. | Apps SDK / App Directory, rollout a partir do início de 2026 |
| **Anthropic (Claude Free/Pro/Max)** | **Custom Connectors via MCP remoto** — disponível em Free (1 conector), Pro, Max, Team e Enterprise. | OAuth de assinatura é *"exclusivo para o Claude Code e o Claude.ai"*. Usar esses tokens em qualquer outro produto — **incluindo o Agent SDK** — viola os Termos de Consumo. Desenvolvedores **não podem coletar, armazenar ou intermediar credenciais ou tokens de sessão do Claude.ai**, nem oferecer login do Claude.ai no próprio app. | Política de OAuth/Agent SDK, 2026 |
| **Google (Gemini)** | Extensões / MCP no Gemini. Caminho corporativo: Vertex AI com OAuth do Google. | Padrão de OAuth do Gemini CLI em software de terceiros **banido em fev/2026**, com **detecção ativa desde 25/03/2026**. Assinatura Google AI do usuário não paga chamadas de app de terceiro. | Anúncio de mitigação de abuso, google-gemini/gemini-cli, 2026 |

### Por que isso importa mais aqui do que em outro produto

Julia é um SaaS multi-tenant para **escritórios de advocacia**. O dado que passaria por essa integração é conversa de cliente, documento pessoal, análise de caso — material sob **sigilo profissional** e, na LGPD, majoritariamente **dado pessoal sensível** (saúde, em BPC/LOAS; dado de menor, em casos de TEA).

Uma conta de consumidor:
- não vem com contrato de tratamento de dados / DPA;
- não dá garantia contratual de não-treinamento equivalente à do plano de API;
- não tem trilha de auditoria exportável;
- e, se compartilhada entre tenants, mistura dados de escritórios diferentes num único login — o oposto do isolamento que o produto promete.

Por isso o Trilho A foi desenhado com **consentimento explícito e escopo mínimo**: quem conecta é o próprio advogado, na conta dele, para os dados do escritório dele (seção 9).

---

## 3. Arquitetura: um núcleo, dois trilhos

```
                        ┌───────────────────────────────────────────────┐
                        │        NÚCLEO DE FERRAMENTAS JURÍDICAS        │
                        │  _shared/copiloto/tools.ts                    │
                        │                                               │
                        │  buscar_lead · ler_conversa · resumo_conversa │
                        │  estado_comercial · listar_documentos         │
                        │  ler_documento · dados_do_caso                │
                        │  status_contrato · gerar_artefato             │
                        └───────────────────────────────────────────────┘
                             ▲                              ▲
                             │ mesmas tools                 │ mesmas tools
              ┌──────────────┘                              └──────────────┐
              │                                                            │
  ┌───────────────────────┐                              ┌─────────────────────────┐
  │  TRILHO A             │                              │  TRILHO B               │
  │  copiloto-mcp         │                              │  copiloto-chat          │
  │  + copiloto-oauth     │                              │  (guard + streaming)    │
  │                       │                              │                         │
  │  OAuth 2.1 + PKCE     │                              │  requireAppIdentity     │
  │  MCP Streamable HTTP  │                              │  xj_client_provider_keys│
  └───────────────────────┘                              └─────────────────────────┘
              ▲                                                            ▲
              │ conecta como "connector"                                   │ usa
              │                                                            │
  ┌───────────────────────────────────┐                  ┌──────────────────────────┐
  │  ChatGPT / Claude / Gemini        │                  │  Tela do Copiloto        │
  │  do próprio advogado              │                  │  dentro da Julia         │
  │  (a assinatura dele paga)         │                  │  (chave do escritório)   │
  └───────────────────────────────────┘                  └──────────────────────────┘
                             │                                        │
                             └────────────┬───────────────────────────┘
                                          ▼
                      ┌───────────────────────────────────────┐
                      │  DADOS (sempre filtrados por client_id)│
                      │  chat_messages · chat_conversations    │
                      │  xj_sessions · xj_legal_cases          │
                      │  xj_deals · crm_deals · xj_contracts    │
                      │  Postgres externo via db-query          │
                      └───────────────────────────────────────┘
```

**A regra que sustenta tudo:** o `client_id` **nunca** vem do argumento da ferramenta nem do corpo da requisição. Ele vem do guard (Trilho B) ou do token OAuth (Trilho A), sempre resolvido no servidor. Isso é obrigatório porque a RLS do Supabase neste projeto é permissiva (`USING (true) WITH CHECK (true)` em praticamente toda tabela) — **o isolamento entre escritórios é responsabilidade do código, não do banco**.

---

## 4. O núcleo de ferramentas

Arquivo novo: `supabase/functions/_shared/copiloto/tools.ts`.

Segue o padrão já estabelecido em `supabase/functions/_shared/x-julia/skills.ts`: um array de definições (JSON Schema) + um dispatcher `switch`.

```ts
// Espelha XJToolDef de _shared/x-julia/llm.ts — mesmo formato serve
// para tool calling de LLM (Trilho B) e para tools/list do MCP (Trilho A).
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
  ctx: CopilotoCtx,
  name: string,
  args: any,
): Promise<string>;   // devolve texto/markdown, como runXJSkill
```

### Catálogo

| Tool | Escopo | O que faz | De onde lê / o que reaproveita |
|---|---|---|---|
| `buscar_lead` | `leads:read` | Localiza o lead por telefone ou nome | `chat_contacts` filtrando `client_id`; telefone **sempre** via `getBrPhoneVariants` (`src/lib/phoneVariants.ts`) — nunca comparação direta de string |
| `ler_conversa` | `leads:read` | Histórico da conversa, já rotulado por autor | **Reusar `loadHistory(supabase, conversationId, contactId, limit, since?)`** de `_shared/x-julia/prompt.ts`. Memória é por **contato** (todas as conversas do lead). Limites: `MAX_HISTORY_CHARS = 60_000`, `MAX_MESSAGE_CHARS = 1200` |
| `resumo_conversa` | `leads:read` | Resumo longo já existente | `chat_conversation_summaries` (`summary`, `atendimento`, `created_at`), últimos 5 por `contact_id` — mesma consulta de `loadContactSummary` |
| `estado_comercial` | `crm:read` | Situação do lead nos três CRMs | `xj_deals` (por `session_id`/`contact_phone`) + `xj_deal_history` (timeline) · `crm_deals` (via `custom_fields.links`) · `crm_atendimento_cards` + `crm_atendimento_stages` no Postgres externo, via `db-query` |
| `listar_documentos` | `documentos:read` | Todos os arquivos do lead/caso | **Lacuna 1** (seção 7): varrer `chat_messages` com `type IN ('document','image')` por `contact_id` + `xj_case_knowledge` por `case_id` |
| `ler_documento` | `documentos:read` | Extrai o conteúdo de um documento | **Reusar `xjResolveMediaBytes`** (`_shared/x-julia/media.ts` — trata download uazapi `.enc` e WABA) + a extração de `_shared/x-julia/documents.ts` |
| `dados_do_caso` | `leads:read` | Ficha do caso jurídico | `xj_legal_cases` (`summary`, `qualification_criteria`, `disqualification_criteria`, `required_documents`, `fee_description`) + `xj_case_questions` + `xj_case_knowledge` |
| `status_contrato` | `crm:read` | Situação da assinatura | `xj_contracts` (`status`, `sign_url`, `signed_at`, `template_id`) e a legada `sing_document` (`status_document` ∈ `CREATED\|SIGNED\|PENDING\|CANCELLED\|DELETED`, `zapsing_doctoken`) — **grafias erradas são os nomes reais** |
| `gerar_artefato` | `artefatos:write` | Persiste relatório / peça / parecer | Grava em `cop_artifacts` (seção 8) |

### Distinção de autor nas mensagens (regra canônica)

Já implementada em `_shared/x-julia/prompt.ts` e **deve ser reaproveitada, não reescrita** — errar isso faz o modelo confundir o que o lead disse com o que a Julia respondeu:

| Origem | Regra | Vira |
|---|---|---|
| Lead | `from_me = false` | `role: "user"` |
| Atendente humano | `from_me = true` **e** `sender_name` preenchido | `role: "user"`, prefixo `[Atendente {sender_name}]` |
| IA / agente | `from_me = true` **e** `sender_name` vazio | `role: "assistant"` |
| Nota interna | `internal_note = true` | `role: "user"`, prefixo `[Nota interna da equipe — {sender_name}]` — nunca vista pelo lead |

Corpo da mensagem: `metadata.transcription` → `text` → `caption` → `[{type}]`.

---

## 5. Trilho A — Servidor MCP + OAuth 2.1

É aqui que a assinatura comum de chat é usada, de forma oficial.

### 5.1 O que se constrói

Duas edge functions novas. **Ambas precisam de `verify_jwt = false`** em `supabase/config.toml` — são chamadas por ChatGPT/Claude/Gemini, que não têm a anon key do projeto:

```toml
[functions.copiloto-oauth]
verify_jwt = false

[functions.copiloto-mcp]
verify_jwt = false
```

> Atenção: no resto do projeto, funções de painel **não** entram no `config.toml` (herdam `verify_jwt = true`, satisfeito pela anon key, com a identidade real vindo do guard). Estas duas são a exceção legítima, e por isso carregam a própria autenticação (OAuth) — não ficam abertas.

| Função | Responsabilidade |
|---|---|
| `copiloto-oauth` | Authorization server: descoberta, `/authorize`, `/token`, registro dinâmico de cliente, revogação |
| `copiloto-mcp` | Resource server: transporte MCP (Streamable HTTP), `initialize`, `tools/list`, `tools/call` → `runCopilotoTool` |

### 5.2 Descoberta (`.well-known`)

O MCP exige metadados em caminhos `.well-known` **na raiz do host**, não sob `/functions/v1/...`. Como o app já tem domínio próprio (`XJ_PUBLIC_APP_URL`, hoje `https://acesso.atendejulia.com.br`), a saída é servir os dois documentos a partir do domínio da aplicação, com *rewrite* para a edge function:

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

### 5.3 Fluxo de autorização

**OAuth 2.1 com PKCE `S256` obrigatório.** Sem client secret no fluxo do ChatGPT (cliente público); o Claude aceita Client ID/Secret pré-registrados.

```
Advogado, no Claude:  Customize → Connectors → Add custom connector
                      URL: https://acesso.atendejulia.com.br/mcp
   │
   ├─1─▶ Claude busca /.well-known/oauth-protected-resource
   │     e /.well-known/oauth-authorization-server
   │
   ├─2─▶ (opcional) POST /register  → registro dinâmico do cliente (RFC 7591)
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
   ├─4─▶ Redirect com ?code=…&state=…      (code em cop_oauth_codes, TTL 60s, uso único)
   │
   ├─5─▶ POST /token  { grant_type: authorization_code, code, code_verifier }
   │     → { access_token, refresh_token, expires_in, scope }
   │        vinculados a user_id + client_id resolvidos NO SERVIDOR
   │
   └─6─▶ POST /mcp  Authorization: Bearer <access_token>
         → initialize / tools/list / tools/call
```

**O ponto crítico de segurança:** no passo 3 a Julia resolve `client_id` a partir do usuário logado — a mesma regra do guard, `COALESCE(u.client_id, parent.client_id)`. O token carrega esse `client_id`. Nenhuma ferramenta aceita `client_id` como argumento. Um token do escritório 402 é fisicamente incapaz de ler dados do escritório 517.

### 5.4 Transporte MCP

`POST /mcp`, JSON-RPC 2.0, resposta em JSON ou SSE conforme o `Accept`:

| Método | Resposta |
|---|---|
| `initialize` | `protocolVersion`, `capabilities: { tools: {} }`, `serverInfo` |
| `tools/list` | `COPILOTO_TOOLS` filtrado pelos escopos do token |
| `tools/call` | `runCopilotoTool(ctx, name, args)` → `{ content: [{ type: "text", text }] }` |

Token inválido/ausente → **401 com header `WWW-Authenticate`** apontando o `resource_metadata` (é o que dispara o fluxo de OAuth automaticamente no cliente).

### 5.5 Como o advogado conecta, por provedor

| Provedor | Caminho na interface | Observações |
|---|---|---|
| **Claude** (Pro/Max/Team/Enterprise; Free = 1 conector) | *Settings → Connectors → Add custom connector* → URL do MCP; Client ID/Secret em *Advanced settings* | O mais direto — não exige aprovação prévia |
| **ChatGPT** (Free/Go/Plus/Pro) | Apps SDK / App Directory | OAuth 2.1 + PKCE S256; cliente via **CIMD** (o `client_id` é a URL de um documento de metadados), DCR ou pré-registro. Permite **renderizar componentes da Julia dentro do ChatGPT**. Passa por revisão da OpenAI |
| **Gemini** | Extensões MCP | Mesmo servidor; validar suporte a OAuth na versão vigente |

### 5.6 Tela "Conexões de IA" na Julia

Necessária para governança: listar tokens ativos do usuário (qual provedor, escopos, criado em, `last_used_at`), botão de **revogar**, e — para o admin do escritório — visão de todas as conexões do tenant.

---

## 6. Trilho B — Copiloto dentro da Julia

O chat na interface da Julia. É o trilho que entrega valor primeiro, porque quase tudo já existe.

### 6.1 Módulo

`src/modules/copiloto/`, no padrão isolado do `x-julia` (a regra do `module.ts` de lá: *"nada fora do módulo importa daqui, e tudo que vem de outros módulos passa por `extend/`"*):

```
src/modules/copiloto/
  module.ts                    ← metadados, menu items (= linhas da matriz de permissões), rotas
  extend/
    db.ts, auth.ts, chat.ts    ← única fronteira com o resto do app
    useEnsureCopilotoModule.ts ← auto-registro idempotente na tabela `modules` (Postgres externo)
  lib/copilotoInvoke.ts        ← headers de identidade (espelha xjInvoke)
  hooks/, components/, pages/
```

Rota em `src/App.tsx` no padrão existente: `lazy()` + `<ProtectedRoute module="copiloto">`.

### 6.2 Edge function `copiloto-chat`

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
  // ...
});
```

Encadeamento por turno:

1. `checkUsageBreach(supabase, clientId, threadId)` — disjuntor de custo, antes de qualquer chamada (`_shared/x-julia/limits.ts`).
2. Monta o system prompt em camadas, no espírito de `buildXJMessages` (`_shared/x-julia/prompt.ts`) — mas com persona de **assistente jurídico do escritório**, não de recepcionista de WhatsApp.
3. Chama o modelo com `COPILOTO_TOOLS`, em streaming.
4. Executa tool calls via `runCopilotoTool`, devolve resultados e continua (loop com teto, como `MAX_TOOL_ROUNDS = 6` no runner do x-julia).
5. `estimateCost(...)` + `logXJEvent(...)` + `bumpUsage(...)`.

### 6.3 Streaming — reaproveitar o padrão que já funciona

`xjComplete()` (`_shared/x-julia/llm.ts`) **não faz streaming** — é sempre request/response completo. Mas `supabase/functions/copilot-chat/index.ts` já tem o padrão certo, e é o que se copia:

```ts
// Um ramo vai ao cliente; o outro é "sniffado" para capturar usage sem bloquear.
const [clientStream, sniffStream] = aiResponse.body!.tee();

(async () => {
  /* lê sniffStream, parseia linhas "data:", extrai obj.usage, loga custo */
})();

return new Response(clientStream, {
  headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
});
```

**Não duplicar a resolução de chaves.** Criar `copilotoStream()` que reusa `resolveKey()` e `XJ_PROVIDERS` de `_shared/x-julia/llm.ts`, apenas acrescentando `stream: true` ao body. Assim o Copiloto herda de graça: os 8 provedores, a chave por escritório (`xj_client_provider_keys`, `kind='llm'`), o fallback para Lovable e os *quirks* de modelo já mapeados (ex.: família GPT-5 recusa `temperature`).

⚠️ **Não replicar os defeitos da `copilot-chat` legada**: ela aceita `userId` no corpo sem validar header (IDOR — qualquer um com a anon key lê o CRM de outro usuário), não tem `client_id`/multi-tenancy e não tem tool calling. Vale corrigir a função antiga em separado.

### 6.4 UI

| Necessidade | De onde copiar |
|---|---|
| Parser SSE com recuperação de chunk parcial | `src/components/copilot/CopilotChatTab.tsx` (linhas ~104-140) — `getReader()` + `TextDecoder`, buffer por `\n`, e o detalhe importante: em `JSON.parse` falho, **recoloca a linha no buffer** |
| Markdown | `src/components/notifications/NotificationCenter.tsx` — `<ReactMarkdown remarkPlugins={[remarkGfm]}>`. **Usar esta**, não a versão do `CopilotChatTab`, que está sem GFM (tabelas não renderizam). `react-markdown@^10.1.0` e `remark-gfm@^4.0.1` já estão instalados |
| Anexo de arquivo | Padrão `fileInputRef` + `pendingMedia` de `src/components/chat/ChatInput.tsx`. Extrair só o padrão — o componente é muito acoplado ao domínio de WhatsApp |
| Áudio | `src/components/chat/AudioRecorder.tsx` — `{ onSend, onCancel }` |
| Layout do módulo | `src/modules/x-julia/components/XJLayout.tsx` |

A chamada usa `fetch` cru (não `supabase.functions.invoke`, que não suporta stream), com os headers de identidade `x-app-user-id` / `x-app-user-email` no formato de `xjIdentityHeaders()`.

### 6.5 Persistência

`cop_threads` e `cop_messages` (DDL na seção 10). A tabela legada `crm_copilot_chat_messages` **não serve**: só tem `user_id`, sem `client_id`.

---

## 7. Leitura de documentos ponta a ponta

O motor de leitura já existe e é bom — `xjReadInbound` em `_shared/x-julia/documents.ts`:

| Tipo | Como é lido |
|---|---|
| Áudio (`audio`/`ptt`) | `chat-transcribe-audio` (preferencial); fallback multimodal `{ type: "input_audio", input_audio: { data, format } }` |
| Imagem / sticker | `{ type: "image_url", image_url: { url: "data:{mime};base64,…" } }` |
| PDF | `{ type: "file", file: { filename, file_data: "data:…" } }` |
| Planilha / CSV / texto | `npm:xlsx@0.18.5` → CSV. **Máx. 5 abas × 200 linhas**, truncado em 20.000 chars |

Bytes vêm de `xjResolveMediaBytes` (`_shared/x-julia/media.ts`), que resolve os casos difíceis: download obrigatório na uazapi (a mídia vem `.enc`), `download_media` na WABA, e URL pública como fallback. Teto: `MAX_BASE64_BYTES = 28_000_000` (~21 MB binário).

### As três lacunas a fechar

**Lacuna 1 — não existe varredura multi-documento.** `xjReadInbound` lê **uma** mídia *inbound* por vez, a partir de uma linha de `chat_messages`. O copiloto precisa de "leia todos os documentos deste lead". Implementar em `listar_documentos`:

```sql
-- Documentos do lead (nunca sem o filtro de client_id)
SELECT id, type, file_name, caption, media_url, timestamp
  FROM chat_messages
 WHERE contact_id = $1
   AND client_id  = $2
   AND type IN ('document', 'image')
 ORDER BY timestamp DESC
 LIMIT 50;
```

`ler_documento` recebe o `id` e chama o pipeline existente. O modelo decide o que abrir — não se lê tudo de uma vez.

**Lacuna 2 — `xj_case_knowledge.file_url` nunca chega ao LLM.** Hoje o agente lê apenas `title` e `content` (truncado em 4.000 chars por item). Um PDF anexado à base de conhecimento do caso é **invisível**. Ligar `file_url`/`file_name`/`mime_type` ao mesmo pipeline de extração.

**Lacuna 3 — não há lugar próprio para documento de caso.** Tudo mora no bucket `chat-media` (não existe `client-files`), indexado por `chat_messages.media_url`. Para o v1 isso basta: `cop_artifacts` referencia o documento de origem. Se surgir upload de documento fora do fluxo de mensagem, aí sim vale um bucket dedicado.

### Política de limites (definir antes de codar)

- Máx. de documentos abertos por pergunta (sugestão: 5) — evita estourar contexto e custo.
- Truncamento por documento e aviso explícito ao modelo quando houve corte.
- Cache do texto extraído (o mesmo PDF não deve ser re-extraído a cada pergunta).

---

## 8. Artefatos: relatórios, peças e pareceres

Todo resultado de trabalho vira uma linha em `cop_artifacts`, com versionamento — um parecer é revisado várias vezes.

| Tipo | Entrada típica | Esqueleto de saída |
|---|---|---|
| `relatorio_atendimento` | conversa + estado no CRM + contrato | Resumo do caso · Linha do tempo · Qualificação · Pendências · Próximo passo |
| `analise_caso` | conversa + documentos + ficha do caso | Fatos · Documentos apresentados e o que falta · Enquadramento · Riscos · Viabilidade |
| `parecer` | análise + base de conhecimento do caso | Consulta · Fatos · Fundamentação · Conclusão |
| `peca` | análise + modelo do escritório | Conforme o template |

Os *templates* de cada tipo ficam em `cop_artifact_templates` (por `client_id`, com fallback global), editáveis pelo escritório — mesmo espírito de `xj_agents.contract_template` e `generation_prompt_config`.

**Exportação:** o repositório já tem o pipeline markdown → HTML → PDF usado para gerar `Julia-Relatorio-Tecnico.pdf` e `docs/Julia-Dossie-Dados.pdf` (conversor próprio + Edge headless com `--print-to-pdf`). Reaproveitar, com CSS de impressão; **não** imprimir HTML de tela.

> **Regra editorial que precisa estar no prompt:** o artefato é rascunho para revisão de advogado. O modelo deve marcar explicitamente o que é inferência e o que veio do documento, e **nunca** inventar número de processo, jurisprudência ou artigo de lei. Alucinação de citação é o risco reputacional mais concreto deste módulo.

---

## 9. Segurança, LGPD e sigilo profissional

### Por trilho

| | Trilho A (MCP) | Trilho B (Copiloto) |
|---|---|---|
| Para onde o dado vai | Para a conta de chat **do próprio advogado** | Para o provedor configurado pelo escritório |
| Base do tratamento | Consentimento explícito no `/authorize`, registrado | Contrato do escritório com o provedor |
| Controle | Escopo por token, revogável a qualquer momento | Chave do escritório, revogável |
| Risco principal | Advogado conectar em conta pessoal com histórico compartilhado | Chave mal configurada / provedor sem DPA |

### Controles obrigatórios (os dois trilhos)

1. **`client_id` sempre do servidor.** Do guard (B) ou do token (A). Nenhuma tool aceita `client_id` como argumento. Toda query filtra explicitamente — a RLS é permissiva e **não** protege.
2. **Escopo mínimo.** Um token com `leads:read` não lê documento.
3. **Trilha de auditoria.** Registrar em `cop_access_log`: quem, qual lead/caso, qual ferramenta, quando, por qual trilho. Isso é o que responde a uma pergunta de cliente ou de auditoria da OAB.
4. **Consentimento registrado** no Trilho A: usuário, provedor, escopos, data, IP.
5. **Opção de mascarar PII** antes de sair para o Trilho A (CPF, RG, endereço) — configurável por escritório; alguns vão querer, outros não.
6. **Aviso na interface** de que o artefato é rascunho sujeito a revisão profissional.

### Contexto herdado (ver [`../CLAUDE.md`](../CLAUDE.md))

Este módulo nasce dentro de um sistema onde a RLS é permissiva, o `db-query` expõe SQL arbitrário e 40+ funções têm `verify_jwt=false`. O Copiloto **não piora** isso, mas amplifica o impacto de qualquer falha de isolamento — porque agora o dado sai do banco em linguagem natural, já resumido. Daí o rigor no item 1.

---

## 10. Modelo de dados

Padrão do projeto: RLS permissiva como o resto + `client_id` obrigatório e filtrado no código. A função de trigger `xj_touch_updated_at()` já existe e é reaproveitada.

```sql
-- ============ Trilho B: conversas do copiloto ============
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

-- ============ Trilho A: OAuth ============
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
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token_hash  text NOT NULL UNIQUE,  -- guardar HASH, nunca o token
  refresh_token_hash text UNIQUE,
  client_key       text NOT NULL,
  app_user_id      text NOT NULL,
  app_client_id    text NOT NULL,
  scopes           jsonb NOT NULL DEFAULT '[]',
  expires_at       timestamptz NOT NULL,
  revoked_at       timestamptz,
  last_used_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cop_oauth_tokens_user ON public.cop_oauth_tokens(app_user_id) WHERE revoked_at IS NULL;

-- ============ Auditoria ============
CREATE TABLE public.cop_access_log (
  id          bigserial PRIMARY KEY,
  client_id   text NOT NULL,
  user_id     text NOT NULL,
  trilho      text NOT NULL CHECK (trilho IN ('mcp','copiloto')),
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

## 11. Roadmap

| Fase | Escopo | Depende de |
|---|---|---|
| **0 — Núcleo** | `_shared/copiloto/tools.ts` com as 9 ferramentas; fechar lacunas 1 e 2 (varredura multi-documento + `xj_case_knowledge.file_url`); migration das tabelas `cop_*` | — |
| **1 — Trilho B** | `copiloto-chat` (guard + streaming + tool calling); módulo `src/modules/copiloto/`; tela de chat; custo e disjuntor | Fase 0 |
| **2 — Trilho A** | `copiloto-oauth` + `copiloto-mcp`; `.well-known` no domínio da app; tela de consentimento; tela "Conexões de IA"; conectar em Claude → ChatGPT → Gemini | Fase 0 |
| **3 — Artefatos** | Tipos, templates por escritório, versionamento, exportação PDF | Fase 1 |

Começar pela Fase 1: entrega valor imediato, não depende de aprovação de terceiros, e valida o núcleo de ferramentas antes de expô-lo publicamente na Fase 2.

---

## 12. Verificação / aceite

**Fase 0**
- [ ] `listar_documentos` devolve os documentos de um lead real, e nenhum de outro escritório (testar com dois `client_id`).
- [ ] `ler_documento` extrai texto de um PDF vindo da uazapi (caminho `.enc`) e de um da WABA.
- [ ] Um PDF em `xj_case_knowledge` passa a ser legível pelo modelo.

**Fase 1**
- [ ] Chamada sem os headers `x-app-user-id`/`x-app-user-email` → **401**.
- [ ] "Resuma o atendimento do lead X" com resposta em streaming, e a distinção lead / atendente / IA correta.
- [ ] Custo do turno aparece em `cop_messages.cost_usd` e a trilha em `xj_session_events`.
- [ ] Com `xj_usage_limits` estourado, o disjuntor bloqueia.

**Fase 2**
- [ ] `/.well-known/oauth-protected-resource` e `/.well-known/oauth-authorization-server` respondem no domínio da app.
- [ ] Conectar no Claude via *Add custom connector*, autorizar, e pedir "resuma o atendimento do lead X" — resposta correta, **sem consumir API da Julia**.
- [ ] Token sem `documentos:read` → `ler_documento` recusa.
- [ ] Revogar na tela "Conexões de IA" → próxima chamada retorna 401.
- [ ] Code reusado → recusado; PKCE ausente → recusado.

**Fase 3**
- [ ] Gerar um parecer, revisar, salvar v2, e ver as duas versões.
- [ ] Exportar em PDF com paginação correta.

---

## Notas de manutenção (achados durante a análise)

- **Bug de rollup de custo:** `xj_analytics_daily` soma `xj_session_events.cost`, mas o runner grava em `xj_session_events.cost_usd` (as duas colunas existem). O custo por evento provavelmente aparece **zerado** no analítico. O disjuntor não é afetado (usa `xj_usage_counters`).
- **IDOR na `copilot-chat` legada:** recebe `userId` no corpo sem validar header. Vale corrigir aplicando `requireAppIdentity`.
- **Duas cópias do módulo de chat** convivem: `src/components/chat/` e `src/modules/julia-chat/chat/`. Alteração em componente de chat precisa considerar as duas.
- **Grafias erradas são os nomes reais** e não devem ser "corrigidas": `sing_document`, `zapsing_doctoken`, `campaing_ads`, `agents_plan.satus`, e a view `"vw_list_client-agents-users"` (com hífen, exige aspas duplas).
