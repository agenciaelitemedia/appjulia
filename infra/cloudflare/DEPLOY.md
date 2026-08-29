# Deploy do Worker MCP no Cloudflare

## Por que deu erro no dashboard?

O carregador do Cloudflare detectou arquivos `.js` no projeto e exige deploy via Wrangler para projetos que precisam de compilação/ESM.

## Pré-requisitos

1. Node.js instalado
2. Conta Cloudflare logada (`npx wrangler login`)
3. Domínio `atendejulia.com.br` gerenciado na mesma conta

## Passo a passo

### 1. Instalar dependências

```bash
cd infra/cloudflare
npm install
```

### 2. Configurar variáveis de ambiente (secrets)

```bash
npx wrangler secret put BACKEND_FUNCTIONS_BASE
# Digite: https://zenizgyrwlonmufxnjqt.supabase.co/functions/v1

npx wrangler secret put ISSUER
# Digite: https://mcp.atendejulia.com.br
```

> Nunca coloque a URL do Supabase diretamente no código. Use secrets.

### 3. Publicar

```bash
npx wrangler deploy
```

O Cloudflare vai criar automaticamente:
- O Worker `mcp-atendejulia`
- O DNS para `mcp.atendejulia.com.br`
- O certificado SSL

### 4. Validar

```bash
curl -s https://mcp.atendejulia.com.br/.well-known/oauth-authorization-server
curl -i -X POST https://mcp.atendejulia.com.br -d '{}'
```

O primeiro deve retornar JSON com `issuer` e endpoints. O segundo deve retornar `401`.

## Solução de problemas

- Se der erro de permissão, verifique se está logado: `npx wrangler whoami`
- Se o domínio não propagar, aguarde 1-2 minutos ou verifique o DNS no painel Cloudflare
- Para logs ao vivo: `npx wrangler tail`
