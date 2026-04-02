

# Correção da Conexão SIP 3C+ - Token do Agente

## Causa raiz confirmada

Analisei a documentação oficial da 3C+ (`api-docs.3c.fluxoti.com`), os dados do banco, e testei os endpoints diretamente. O problema tem **duas causas**:

### 1. Token errado no `/agent/webphone/login`

O endpoint `POST /agent/webphone/login` pertence ao grupo **Agent** da API 3C+. Endpoints `/agent/*` exigem o **token do próprio agente**, não o token do gestor/admin.

Hoje o `threecplus-proxy` usa sempre `config.threecplus_token` (token do gestor: `57nwW8Y...`) para todas as chamadas. Quando chama `/agent/webphone/login`, recebe:

```
403: "Você não tem permissão para acessar esse recurso."
```

O token correto do agente está salvo em `threecplus_raw.data.api_token`: `DTunnpulesthWRDPsOKVm7oo5hGqM8JWVhP8qqOQdDsHZMeWS9hznqEL3x0B`

### 2. Webphone não habilitado

A resposta da 3C+ mostra `webphone: false` no agente. O sistema tentou habilitar via `PUT /users/{id}` com `webphone: true`, mas o campo permaneceu `false` na resposta. Isso pode ser um campo que precisa ser habilitado no painel da 3C+, ou a habilitação requer o token do agente.

### 3. Consequência

Sem o login correto no webphone, não obtemos o `sip_server` real da 3C+. O sistema deriva o domínio de `threecplus_base_url` (`assessoria.3c.fluxoti.com`), que é o host do **tenant/API**, e pode ou não ser o mesmo host do PBX/SIP. O WebSocket fecha com 1006 porque pode estar tentando conectar no host errado ou sem as credenciais corretas.

## Plano de correção

### 1. Usar token do agente para endpoints `/agent/*`

No `threecplus-proxy`, para as actions que chamam endpoints do grupo `/agent/*`:
- `get_sip_credentials` (chama `/agent/webphone/login`)
- `validate_sip` (chama `/agent/webphone/login`)

Extrair o `api_token` do agente a partir de `threecplus_raw.data.api_token` e usar esse token em vez do token do gestor.

```text
Antes:  threecRequest(baseUrl, managerToken, "/agent/webphone/login", ...)
Depois: threecRequest(baseUrl, agentToken,   "/agent/webphone/login", ...)
```

O token do gestor continua sendo usado para endpoints administrativos (`/users/*`, `/agents`, `/click2call`, etc.).

### 2. Forçar habilitação do webphone com token do agente

Tentar habilitar webphone usando o token do agente ao invés do gestor, via PUT no endpoint do próprio usuário. Se ainda não funcionar, adicionar um aviso claro no diagnóstico para que o administrador habilite manualmente no painel 3C+.

### 3. Usar credenciais retornadas pelo login

Quando `/agent/webphone/login` retornar sucesso, a resposta contém os campos reais:
- `sip_server` / `domain` / `host` - domínio SIP correto do PBX
- `sip_user` / `username` - usuário SIP
- `sip_password` / `password` - senha SIP
- Possivelmente `port` e `ws_url`

Essas credenciais devem ser cacheadas e usadas pelo JsSIP, substituindo qualquer derivação manual.

### 4. Atualizar diagnóstico

Mostrar no diagnóstico SIP:
- Se o webphone está habilitado (`webphone: true/false`)
- Se o login usou token do agente
- Quais campos a resposta do login retornou

### 5. Remover `sip.js` do package.json

O pacote `sip.js` (0.21.2) ainda está listado no `package.json` embora já tenhamos migrado para `jssip`. Limpar essa dependência residual.

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/threecplus-proxy/index.ts` | Usar agent token para `/agent/*` endpoints; melhorar enable_webphone |
| `package.json` | Remover `sip.js` residual |

## Resultado esperado

1. O `/agent/webphone/login` passa a retornar 200 com as credenciais SIP reais
2. O JsSIP conecta usando o `sip_server` correto retornado pela 3C+
3. O WebSocket 1006 desaparece porque o domínio/porta serão os corretos
4. Se webphone estiver desabilitado, o diagnóstico indica claramente o que fazer

## Validação

Após deploy:
1. Chamar `validate_sip` para confirmar que o login retorna credenciais
2. Recarregar `/telefonia` e verificar o diagnóstico SIP
3. Confirmar que o WS Estado muda para `connected` e Registro para `registered`

