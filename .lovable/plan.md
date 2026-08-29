# Plano — MCP em domínio próprio (mcp.atendejulia.com.br) via proxy

## Por que CNAME puro não funciona

Um registro CNAME apenas aponta o DNS. A conexão HTTPS chega ao Supabase com o
hostname `mcp.atendejulia.com.br` no TLS (SNI) e no header `Host`, e o Supabase não
possui certificado nem roteamento para esse nome — a chamada falha antes de chegar
na edge function. Para o domínio funcionar é preciso algo que **termine o TLS no
Cloudflare e refaça a chamada ao backend**: um Cloudflare Worker (proxy).

## O que será implementado

### 1. Cloudflare Worker de proxy (a ser criado pelo usuário no painel Cloudflare)

Arquivo pronto no repo: `infra/cloudflare/mcp-proxy-worker.js`, com instruções
de publicação no topo. Comportamento:

- Responde em `https://mcp.atendejulia.com.br` e repassa para
  `https://<projeto>.supabase.co/functions/v1/copiloto-mcp` preservando método,
  corpo, `Authorization`, `Content-Type`, `Accept` (SSE) e querystring.
- Adiciona `x-forwarded-host: mcp.atendejulia.com.br` para a function publicar
  metadados com a URL pública correta.
- Responde CORS (`OPTIONS`) na borda.
- Rota extra: `/.well-known/oauth-protected-resource` também é repassada.

Configuração no Cloudflare (conta do domínio atendejulia.com.br):

```text
1. Workers & Pages → Create Worker → colar o script
2. Variável de ambiente MCP_ORIGIN = https://zenizgyrwlonmufxnjqt.supabase.co/functions/v1/copiloto-mcp
3. Triggers → Custom Domains → adicionar mcp.atendejulia.com.br
   (o próprio Cloudflare cuida do certificado; sem CNAME manual)
```

### 2. Ajustes no código (reaplicar o que foi revertido, de forma mínima)

- `src/modules/mvp-copiloto/lib/copilotoApi.ts`
  - `MCP_URL = 'https://mcp.atendejulia.com.br'` (exibida em `/mvp-copiloto`);
  - `MCP_INTERNAL_URL` continua sendo a function do backend para o testador interno.
- `supabase/functions/copiloto-mcp/index.ts`
  - `MCP_PUBLIC_URL` passa a vir de `COPILOTO_MCP_PUBLIC_URL` (fallback
    `https://mcp.atendejulia.com.br`) para o `resource` do
    `/.well-known/oauth-protected-resource` bater com a URL pública.
- `docs/MCP_julia.md` — documentar a arquitetura final com o proxy.
- Reimplantar `copiloto-mcp`.

### 3. Validação

1. `POST https://mcp.atendejulia.com.br` sem token → `401` com `WWW-Authenticate`
   apontando para o discovery de `acesso.atendejulia.com.br`.
2. `GET https://mcp.atendejulia.com.br/.well-known/oauth-protected-resource` →
   documento com `resource` = URL pública e `authorization_servers` = domínio da Julia.
3. Fluxo OAuth completo no OpenClaw: discovery → registro → `/authorize` (domínio da
   Julia) → consentimento → token → `tools/list` com 27 ferramentas.

## Detalhes técnicos

- O Worker é o único componente fora do repo; todo o resto já existe (OAuth,
  consentimento em `/authorize`, MCP com 27 tools, revogação em `/mvp-copiloto`).
- Sem o Worker publicado, `/mvp-copiloto` continuaria exibindo a URL da function do
  backend — por isso o plano só altera `MCP_URL` após o Worker estar no ar, ou já
  altera e a URL só passa a funcionar quando o Worker for publicado (decidirei com
  base na sua resposta).
- Nenhum segredo novo: `MCP_ORIGIN` é apenas a URL pública da edge function.

## Decisão pendente

- Publicar o código apontando para `mcp.atendejulia.com.br` **agora** (fica quebrado
  até você criar o Worker) ou **somente depois** que o Worker estiver ativo?
