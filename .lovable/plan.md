# Conectar o MCP no OpenClaw: por que deu "requested path is invalid" e como resolver

## Diagnóstico (confirmado por teste)

O OpenClaw abriu `https://<host>/authorize?...` — a raiz do host, não o endpoint do conector.
Nosso discovery está correto e responde:

```text
GET /functions/v1/copiloto-oauth/.well-known/oauth-authorization-server  → 200
  issuer:                 .../functions/v1/copiloto-oauth
  authorization_endpoint: .../functions/v1/copiloto-oauth/authorize
GET /authorize                                        → 404 {"error":"requested path is invalid"}
GET /.well-known/oauth-authorization-server (raiz)    → 404 (mesmo erro)
```

O cliente registrou-se com sucesso (o `client_id=cop_...` é nosso, veio do nosso
`/register`), então ele leu o documento — mas montou o authorize resolvendo o caminho
**relativo à raiz do issuer** (`new URL("/authorize", issuer)`), descartando o prefixo
`/functions/v1/copiloto-oauth`. Como o issuer da Julia vive num subcaminho do host do
backend, e esse host não é nosso na raiz, não há como servir `/authorize` ali: o gateway
responde o 404 acima. A forma "path-insertion" do RFC 8414
(`/.well-known/oauth-authorization-server/functions/v1/copiloto-oauth`) também é barrada
pelo gateway (exige `apikey`), então não há caminho de discovery na raiz para oferecer.

Conclusão: não é bug do nosso servidor nem de permissão — é incompatibilidade entre o
issuer em subcaminho e a resolução de endpoints do cliente. Enquanto o conector estiver
publicado nesse host, o fluxo OAuth automático do OpenClaw continuará falhando.

## Solução proposta: conexão por chave de acesso (Bearer estático)

Todo cliente MCP (OpenClaw, Claude, Cursor) aceita servidor remoto com um header
`Authorization: Bearer <token>` fixo, sem OAuth. Isso funciona hoje, mantém o mesmo
isolamento (o escritório é resolvido no servidor e gravado no token; as tools ignoram
qualquer identificador do cliente) e continua somente leitura e revogável.

Na página `/mvp-copiloto`:

1. Novo cartão **"Chaves de acesso"**:
   - botão "Gerar chave", pedindo e-mail e senha da Julia (mesma validação do consentimento)
     e um rótulo ("OpenClaw do meu notebook") e validade (30 / 90 / 365 dias);
   - a chave aparece **uma única vez** para copiar, com aviso de que não será exibida novamente;
   - lista das chaves existentes: rótulo, criada em, expira em, último uso, escopo, com
     revogação individual (confirmação dupla).
2. O cartão de conexão passa a mostrar a configuração pronta para colar no OpenClaw
   (URL do MCP + header `Authorization`), com botão copiar.
3. As instruções de OAuth ficam recolhidas num aviso: "fluxo OAuth automático indisponível
   neste endereço; use a chave de acesso".
4. O simulador de ferramentas passa a usar a chave selecionada em vez do token de teste de 15 min.

Nada de escrita é adicionado: o catálogo de 27 tools de leitura permanece igual.

## Detalhes técnicos

- `supabase/functions/copiloto-oauth/index.ts`: nova rota `POST /access-key` (valida
  e-mail+senha via `db-query`, grava em `cop_oauth_tokens` com `client_id` do escritório,
  `scope` `leads:read julia:read`, `label`, `expires_at` conforme escolha) e
  `GET /access-keys` + `POST /access-keys/revoke` (autenticadas pela mesma senha).
  As rotas de OAuth (discovery, DCR, authorize, consent, token, refresh, revoke) ficam
  intactas para clientes que resolvem o issuer corretamente.
- Migration: adicionar `label text` e `last_used_at timestamptz` em `cop_oauth_tokens` se
  ainda não existirem; nenhuma tabela nova.
- `copiloto-mcp` já valida Bearer contra `cop_oauth_tokens` — sem mudança de contrato;
  apenas atualizar `last_used_at` na validação.
- Frontend: `src/modules/mvp-copiloto/components/AccessKeysCard.tsx` (novo),
  ajustes em `McpConnectionCard.tsx`, `McpSimulatorCard.tsx`, `MvpCopilotoPage.tsx` e
  `lib/copilotoApi.ts`. Nenhum segredo no cliente.
- `docs/MCP_julia.md`: seção "Conectar com chave de acesso" e nota sobre a limitação do
  discovery em subcaminho.

## Validação

1. Gerar uma chave na página, configurar o servidor MCP remoto no OpenClaw com o header e
   confirmar que `tools/list` lista as 27 ferramentas.
2. Rodar `buscar_lead` + `analisar_atendimento` de um lead real pelo OpenClaw.
3. Revogar a chave e confirmar que a chamada seguinte volta 401.
4. Confirmar que uma chave de um escritório não retorna dados de outro.

## Alternativa (se preferir manter OAuth automático)

Só funciona publicando o conector na **raiz de um domínio seu** (ex.: `mcp.atendejulia.com.br`)
por meio de um proxy que repasse `/authorize`, `/token`, `/register` e `/.well-known/*` para a
edge function. Isso depende de infraestrutura fora da Lovable (Cloudflare Worker ou similar
no seu DNS); posso preparar o código e as regras de proxy se você quiser esse caminho.
