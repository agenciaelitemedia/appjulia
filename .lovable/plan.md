
# Correção do erro SIP 3C+ (WebSocket 1006)

## Diagnóstico confirmado

Analisei o código, os dados atuais e os logs. O problema principal não está mais nas credenciais do ramal, e sim na camada de transporte WebRTC/SIP.

### O que ficou comprovado
- O frontend está tentando conectar em:
  - domínio SIP: `assessoria.3c.fluxoti.com`
  - WebSocket: `wss://assessoria.3c.fluxoti.com:8089/ws`
- O erro é `WebSocket closed ... (code: 1006)` com timeout de conexão.
- Esse tipo de erro acontece antes do registro SIP, então é falha de host/porta/TLS/handshake, não de usuário/senha.
- No banco, a configuração atual do agente `202601003` está assim:
  - `threecplus_base_url = https://assessoria.3c.fluxoti.com/api/v1`
  - `sip_domain = assessoria.3c.fluxoti.com`
- O ramal `1000` também está cacheado com `threecplus_sip_domain = assessoria.3c.fluxoti.com`.
- No `threecplus-proxy`, a action `get_sip_credentials` monta o socket como `wss://${domain}:8089/ws`.
- O campo `threecplus_ws_url` já existe no banco/UI, mas hoje não é usado no softphone; a UI ainda o descreve como “WebSocket de eventos”, o que induz configuração errada.

### Causa mais provável
O host da API do tenant 3C+ (`assessoria.3c.fluxoti.com`) foi reutilizado como host SIP/WebSocket. Em 3C+, isso frequentemente é separado:
- API REST: tenant/app host
- SIP/WebRTC WSS: PBX host, tipicamente algo como `pbx01.3c.fluxoti.com`

Ou seja: a API pode estar correta em `assessoria...`, mas o WSS do softphone precisa apontar para o PBX.

## Plano de correção

### 1. Corrigir a configuração persistida do agente
Atualizar a configuração do agente `202601003` para separar API de SIP/WebSocket:
- `threecplus_base_url = https://assessoria.3c.fluxoti.com/api/v1`
- `sip_domain = pbx01.3c.fluxoti.com`
- `threecplus_ws_url = wss://pbx01.3c.fluxoti.com:8089/ws`

Também vou alinhar o cache do ramal para evitar inconsistência visual/futura.

### 2. Corrigir a lógica do `threecplus-proxy`
Hoje o proxy ignora `threecplus_ws_url` e sempre deriva o socket a partir do domínio. Vou ajustar para:
- usar `config.threecplus_ws_url` como prioridade para `wsUrl`
- usar `config.sip_domain` como domínio SIP/registrar
- aplicar isso em todos os caminhos:
  - cacheado no banco
  - extração do `threecplus_raw`
  - resposta do `/agent/webphone/login`

Isso elimina o acoplamento incorreto entre “domínio SIP” e “host WSS”.

### 3. Ajustar a tela administrativa de configuração
Na aba de configuração 3C+:
- renomear o campo `threecplus_ws_url` para algo claro como:
  - `URL WebSocket SIP/WebRTC`
- manter `URL Base API` separado
- manter `Domínio SIP (PBX/Registrar)` separado
- remover o texto atual de “WebSocket de eventos”, porque hoje esse campo não está servindo para isso

### 4. Melhorar o diagnóstico no frontend
Ajustar o diagnóstico SIP para deixar explícito:
- domínio SIP/registrar
- URL WebSocket efetiva
- opcionalmente a origem das credenciais (`cache`, `raw`, `login`)
Assim, se falhar de novo, ficará claro qual host o softphone realmente tentou usar.

## Arquivos envolvidos
- `supabase/functions/threecplus-proxy/index.ts`
- `src/pages/admin/telefonia/components/ConfigTab.tsx`
- possível ajuste leve em tipos, se necessário:
  - `src/pages/admin/telefonia/types.ts`

## Detalhes técnicos
- Não precisa criar nova tabela nem nova coluna: os campos necessários já existem.
- A correção central é fazer o softphone usar:
  - API: `assessoria.3c.fluxoti.com/api/v1`
  - SIP/WSS: `pbx01.3c.fluxoti.com`
- O código atual monta:
```text
wsUrl = wss://<sip_domain>:8089/ws
```
e isso está errado para este cenário.
- Após a correção, a resposta de `get_sip_credentials` deve retornar algo equivalente a:
```json
{
  "domain": "pbx01.3c.fluxoti.com",
  "username": "SD9uLTKkWr",
  "password": "...",
  "wsUrl": "wss://pbx01.3c.fluxoti.com:8089/ws"
}
```

## Validação após implementar
1. Abrir `/telefonia`
2. Verificar no diagnóstico SIP:
   - Domínio: `pbx01.3c.fluxoti.com`
   - WebSocket: `wss://pbx01.3c.fluxoti.com:8089/ws`
3. Confirmar que o erro `1006` deixa de ocorrer
4. Se ainda houver falha, o próximo erro esperado já será de autenticação/registro SIP, o que indicará que a camada de transporte foi corrigida e o problema restante será outro

## Resultado esperado
O ramal 3C+ volta a conectar no softphone usando o host correto do PBX, sem depender do domínio do tenant web/API.
