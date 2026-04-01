
# Correção do 3C+ Websoftphone

## Diagnóstico confirmado

O erro atual não está mais no cadastro do ramal nem na escolha do host. Pelos logs e pela pesquisa:

- o frontend já está tentando exatamente:
  - `sip:SD9uLTKkWr@pbx01.3c.fluxoti.com`
  - `wss://pbx01.3c.fluxoti.com:8089/ws`
- a edge function está retornando esses dados corretamente
- o fechamento `WebSocket closed ... (code: 1006)` acontece antes do `REGISTER`, então usuário/senha do ramal nem chegaram a ser validados
- a documentação do Asterisk confirma que `1006` nesse cenário costuma ser handshake/TLS/endpoint/proxy no WSS
- mais importante: a documentação oficial da 3C+ encontrada indica outro fluxo para CRM:
  - usar Socket.io para eventos do agente
  - usar a URL oficial do ramal web: `https://{dominio}.3c.plus/extension?api_token={token_do_agente}`
  - depois fazer login do agente/campanha via API
- a própria doc da 3C+ diz que token de gestor não executa ações “como agente”; para operar o agente, deve-se usar o token do agente
- o retorno salvo no banco ainda mostra `webphone: false`, reforçando que o fluxo atual não está alinhado com o modo oficial deles

Conclusão: o problema mais provável não é “qual domínio SIP usar”, e sim que estamos tentando integrar o 3C+ como um softphone SIP nativo via `sip.js`, enquanto a integração oficialmente suportada pela 3C+ para CRM é incorporar o ramal web deles e usar Socket.io + API.

## Melhor abordagem

Trocar a integração 3C+ de “SIP nativo pelo browser” para “Ramal Web oficial da 3C+ embutido no CRM”.

Isso evita depender do `wss://pbx01...:8089/ws` diretamente no nosso `sip.js`, que é justamente onde está quebrando.

## Plano de implementação

### 1. Separar Api4Com e 3C+ no `PhoneContext`
- manter `useSipPhone` apenas para Api4Com
- criar um fluxo específico para 3C+ no contexto global
- parar de chamar `get_sip_credentials`/`sip.js` quando o provedor for `3cplus`

### 2. Implementar launcher oficial do Ramal Web 3C+
No backend do 3C+:
- adicionar uma action para montar a URL oficial do extension web usando o token do agente
- garantir que o usuário 3C+ esteja com webphone habilitado antes de abrir
- usar o token do próprio agente, não o token do gestor, para as ações de agente

No frontend:
- abrir o ramal web oficial dentro do CRM
- tentativa principal: iframe persistente com `allow="microphone"`
- fallback seguro: popup/janela controlada caso o 3C+ bloqueie iframe por CSP/X-Frame-Options

### 3. Adotar o fluxo oficial da 3C+ para estado do agente
Implementar cliente Socket.io para 3C+ e refletir no UI:
- `agent-is-idle`
- `agent-login-failed`
- `call-was-connected`
- `call-was-finished`
- `agent-in-acw`

Assim, o status da telefonia deixa de depender de `REGISTER` SIP do `sip.js` e passa a refletir o estado real do agente 3C+.

### 4. Ajustar a tela `/telefonia`
- trocar o bloco de diagnóstico SIP por diagnóstico 3C+:
  - modo de conexão: `Ramal Web oficial`
  - origem: `iframe` ou `popup`
  - status do agente via Socket.io
  - campanha/logado/ocioso/em chamada/TPA
- manter o widget visual de softphone, mas como shell do 3C+, não como SIP nativo

### 5. Corrigir segurança dos dados sensíveis
Hoje o frontend consulta `phone_extensions` com `select('*')`, e isso expõe dados sensíveis do 3C+ no cliente.

Vou ajustar para:
- parar de buscar colunas sensíveis no frontend
- deixar token do agente/segredos apenas no backend
- retornar ao cliente só o necessário para abrir/controlar o ramal oficial

## Arquivos principais

- `src/contexts/PhoneContext.tsx`
- `src/pages/telefonia/hooks/useSipPhone.ts` (Api4Com somente)
- `src/pages/telefonia/components/DiscadorTab.tsx`
- `src/pages/telefonia/components/SoftphoneWidget.tsx`
- `supabase/functions/threecplus-proxy/index.ts`
- possivelmente novo hook/componente para 3C+ webphone e socket

## Resultado esperado

Para 3C+:
- o sistema deixa de depender de `wss://pbx01.3c.fluxoti.com:8089/ws` diretamente no browser
- o ramal passa a conectar pelo método oficialmente documentado pela 3C+
- o status da telefonia passa a ser guiado por eventos reais do agente
- some o erro recorrente `WebSocket closed ... code 1006` do fluxo atual

## Validação após implementar

1. Abrir `/telefonia`
2. Confirmar abertura do ramal oficial 3C+
3. Verificar permissão de microfone
4. Confirmar estado `ocioso/disponível` via evento 3C+
5. Testar ligação manual e recebimento
6. Confirmar que não há mais tentativa de conexão SIP nativa para 3C+ no console
