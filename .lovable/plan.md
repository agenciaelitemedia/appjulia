# Publicar o conector MCP num endereço do próprio sistema (domínio da Julia)

## O problema, em uma frase

O OpenClaw montou o authorize resolvendo o caminho **a partir da raiz do host** do backend
(`/authorize`), ignorando o prefixo `/functions/v1/copiloto-oauth` — e nessa raiz o gateway
responde `{"error":"requested path is invalid"}`. Confirmado por teste:

```text
/functions/v1/copiloto-oauth/.well-known/oauth-authorization-server → 200 (nosso documento, correto)
/authorize                                                          → 404 requested path is invalid
/.well-known/oauth-authorization-server (raiz do host do backend)   → 404 requested path is invalid
```

Ou seja: enquanto o issuer viver num subcaminho, clientes que resolvem endpoints
relativos à raiz continuarão falhando. A saída é publicar o conector na **raiz de um
domínio nosso**.

## Estratégia: endereço do conector no domínio da Julia

Verificado no domínio atual (`acesso.atendejulia.com.br`): arquivos estáticos são servidos
normalmente e caminhos desconhecidos caem no app (SPA). Com isso conseguimos servir, no
nosso próprio domínio:

1. **Documentos de descoberta na raiz** — arquivos estáticos em
   `public/.well-known/oauth-authorization-server` e
   `public/.well-known/oauth-protected-resource`, com:
   - `issuer`: `https://acesso.atendejulia.com.br` (raiz — é isto que corrige a resolução);
   - `authorization_endpoint`: `https://acesso.atendejulia.com.br/authorize`;
   - `token_endpoint`, `registration_endpoint`, `revocation_endpoint`: URLs absolutas das
     rotas já existentes do conector;
   - `resource`: a URL do MCP.
2. **Rota `/authorize` no app** — página que recebe os parâmetros (`client_id`,
   `code_challenge`, `redirect_uri`, `state`, `scope`) e redireciona preservando a query
   para o authorize do conector. É a etapa que abre no navegador, então uma rota do app
   resolve perfeitamente. Ela reaproveita a tela de consentimento que já existe
   (`/copiloto/consentimento`).
3. **Rota `/mcp` no app** — página curta que documenta o endpoint e redireciona chamadas de
   navegador; a URL a colar no OpenClaw continua sendo a do MCP.

Nada disso muda a segurança: o escritório continua sendo resolvido no servidor no login de
consentimento e gravado no token; as tools ignoram qualquer identificador vindo do cliente;
escopo somente leitura; revogável.

## Limite conhecido (e por isso entregamos os dois caminhos juntos)

`/token`, `/register` e `/revoke` são chamadas **POST feitas pelo próprio OpenClaw**, e a
hospedagem do app é estática — não é possível responder POST numa rota do app. Elas ficam
nas URLs absolutas do conector, publicadas no documento de descoberta. Se o OpenClaw usar as
URLs do documento (comportamento normal), o OAuth fecha. Se ele também resolver `/token` à
raiz, o token falha — e para não deixar você travado, o segundo caminho vai implementado na
mesma entrega:

**Caminho 2 (entregue junto, garante a conexão):** conexão por **chave de acesso** — cartão em
`/mvp-copiloto` para gerar um token de longa duração (rótulo, validade, exibido uma única
vez, com lista e revogação), e o OpenClaw configurado com header
`Authorization: Bearer <chave>`, sem OAuth. Funciona em qualquer cliente MCP e mantém o
mesmo isolamento por escritório, somente leitura e revogação imediata.


## Detalhes técnicos

- `public/.well-known/oauth-authorization-server` e `public/.well-known/oauth-protected-resource`
  (arquivos estáticos, sem segredos). Confirmar na validação se são servidos com
  `content-type` aceitável; se não, adicionar as variantes `*.json` e apontar o documento
  para elas.
- `src/pages/CopilotoAuthorizeRedirect.tsx` (nova) + rota `/authorize` em `App.tsx`:
  monta a URL do authorize do conector com a query original e faz `window.location.replace`.
- `supabase/functions/copiloto-oauth/index.ts`: aceitar `issuer` público configurável
  (constante com o domínio da Julia) nos documentos de descoberta e no campo `iss`, e
  permitir `redirect_uri` de loopback (`http://127.0.0.1:*`) como já ocorre. Nenhuma mudança
  no fluxo PKCE, consentimento, troca, refresh e revogação.
- `supabase/functions/copiloto-mcp/index.ts`: `WWW-Authenticate` passa a apontar o
  `resource_metadata` do domínio da Julia.
- `src/modules/mvp-copiloto/pages/MvpCopilotoPage.tsx` e `McpConnectionCard.tsx`: exibir a
  nova URL do conector (domínio da Julia) e o passo a passo atualizado.
- `docs/MCP_julia.md`: registrar o novo endereço, o motivo (issuer na raiz) e o plano B.
- Nenhuma migration; catálogo de tools somente leitura permanece igual.

## Validação

1. `GET https://acesso.atendejulia.com.br/.well-known/oauth-authorization-server` retorna o
   documento e `/authorize?...` redireciona para a tela de consentimento com a query intacta.
2. Adicionar o servidor MCP no OpenClaw usando a URL do domínio da Julia: registro,
   consentimento e emissão de token concluídos sem `requested path is invalid`.
3. `tools/list` lista as 27 ferramentas; rodar `buscar_lead` + `analisar_atendimento` num
   lead real.
4. Revogar a conexão e confirmar 401 na chamada seguinte; confirmar que token de um
   escritório não vê dados de outro.
5. Se o passo 2 falhar no `token_endpoint`, seguir com o plano B (chave de acesso) na mesma
   página.
