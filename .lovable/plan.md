# Plano — Fazer o OAuth do conector funcionar no OpenClaw

## Causa raiz (confirmada por teste agora)

| Verificação | Resultado |
| --- | --- |
| `.../functions/v1/copiloto-mcp/.well-known/oauth-protected-resource` | **200** — aponta o issuer `https://acesso.atendejulia.com.br` |
| `POST .../copiloto-mcp` sem token | **401** com `WWW-Authenticate` correto |
| `https://acesso.atendejulia.com.br/.well-known/oauth-authorization-server` | **404 "Not found"** |
| `.../.well-known/oauth-authorization-server.json` | **404 "Not found"** |
| `https://acesso.atendejulia.com.br/robots.txt` (mesmo `public/`) | **200** |
| `https://<backend>/.well-known/oauth-authorization-server` (raiz) | **404 `requested path is invalid`** |

O `public/` é servido (robots.txt prova), mas o diretório `/.well-known/` é
**reservado pela hospedagem** e devolve 404. Sem o discovery do issuer, o OpenClaw
usa o padrão do protocolo: monta `/authorize` na **raiz do host do recurso** — e essa
raiz é o backend, que responde `{"error":"requested path is invalid"}`. É exatamente o
erro que você recebeu.

Corolário: enquanto o discovery não for servido num host cuja **raiz** também
responda `/authorize`, `/token`, `/register` e `/revoke`, o fluxo continua quebrando.
E um CNAME simples não serve: o TLS chegaria ao backend com um hostname para o qual ele
não tem certificado.

## Solução: um único subdomínio com proxy (Cloudflare Worker)

Publicar todo o conector em `https://mcp.atendejulia.com.br`, onde a **raiz** do host
atende tudo que os clientes MCP esperam encontrar na raiz:

```text
mcp.atendejulia.com.br
├── /.well-known/oauth-authorization-server   -> discovery (servido pelo Worker)
├── /.well-known/oauth-protected-resource     -> discovery do recurso
├── /authorize                                -> redireciona p/ tela de consentimento da Julia
├── /token  /register  /revoke                -> proxy p/ copiloto-oauth (POST)
└── /  (POST JSON-RPC, SSE)                   -> proxy p/ copiloto-mcp
```

Assim o issuer passa a ser `https://mcp.atendejulia.com.br` (raiz), e qualquer cliente
— OpenClaw, ChatGPT, Claude — resolve todos os endpoints corretamente. A tela de
consentimento continua no domínio do app (`acesso.atendejulia.com.br`), que é onde o
usuário faz login: o `/authorize` do Worker só encaminha o navegador para lá.

### Passos

1. **Worker** (`infra/cloudflare/mcp-proxy-worker.js`, recriado no repo): roteia os
   caminhos acima, preserva método/corpo/`Authorization`/`Accept` (SSE), responde CORS
   e serve os dois documentos de discovery com os endpoints já na raiz do subdomínio.
   Variável de ambiente: `BACKEND_FUNCTIONS_BASE`.
2. **Publicação no Cloudflare** (você faz, 3 cliques): Workers & Pages → criar Worker →
   colar o script → definir a variável → Triggers → Custom Domain
   `mcp.atendejulia.com.br`. O Cloudflare emite o certificado; sem CNAME manual.
3. **Backend** (`supabase/functions/copiloto-oauth/index.ts`): o `issuer` e o `iss` dos
   documentos/códigos passam a ser `https://mcp.atendejulia.com.br`, configurável por
   `COPILOTO_ISSUER`. `copiloto-mcp` publica o mesmo host no `resource` e no
   `WWW-Authenticate`. Nenhuma mudança no PKCE, consentimento, troca, refresh ou revogação.
4. **Frontend**: `MCP_URL` volta a ser `https://mcp.atendejulia.com.br` no cartão de
   `/mvp-copiloto`; o testador interno continua chamando a function direto.
5. **Limpeza**: remover `public/.well-known/*` (comprovadamente não servidos) e a rota
   `/authorize` do app deixa de ser necessária como issuer — mantida apenas como atalho.
6. Reimplantar `copiloto-oauth` e `copiloto-mcp`.

## Validação

1. `GET https://mcp.atendejulia.com.br/.well-known/oauth-authorization-server` → 200 com
   `issuer` e endpoints todos na raiz do subdomínio.
2. `POST https://mcp.atendejulia.com.br` sem token → 401 com `WWW-Authenticate`.
3. No OpenClaw: adicionar o servidor → registro dinâmico → `/authorize` abre a tela de
   consentimento da Julia → login → aprovar → token emitido, sem
   `requested path is invalid`.
4. `tools/list` lista as 27 ferramentas; rodar uma leitura num lead real.
5. Revogar em `/mvp-copiloto` e confirmar 401 na chamada seguinte.

## Alternativa, se você não quiser criar o Worker

Sem um host cuja raiz responda os endpoints OAuth, não há como fazer o fluxo automático
do OpenClaw funcionar — é limitação da hospedagem estática (`/.well-known` bloqueado) e
da raiz do backend. O caminho possível nesse cenário seria voltar a emitir um token de
acesso de longa duração pela página `/mvp-copiloto` e configurá-lo como
`Authorization: Bearer` no OpenClaw (sem OAuth). Você já recusou esse caminho antes, por
isso ele fica registrado apenas como alternativa, não como proposta.

## Sobre o `code=` que você pediu

Não é possível eu autorizar por você: o `redirect_uri` do pedido é
`http://127.0.0.1:8989/oauth/callback`, um servidor local na **sua** máquina, e o
consentimento exige seu e-mail e senha da Julia. Além disso, o link atual aponta para a
raiz do backend, que é justamente o endereço inválido. Depois do Worker publicado, o
OpenClaw vai gerar o link correto e capturar o `code` sozinho.
