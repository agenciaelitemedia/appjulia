
Diagnóstico confirmado

- O sistema ainda está tentando registrar o ramal 3C+ com host derivado do tenant API: `assessoria.3c.fluxoti.com`.
- Isso ficou comprovado no request atual do backend:
  - `domainSource: "derivado de threecplus_base_url (https://assessoria.3c.fluxoti.com/api/v1)"`
  - candidatos WSS todos em `assessoria.3c.fluxoti.com`
- No banco hoje:
  - `phone_config` do agente `202601003`: `sip_domain = null`, `threecplus_ws_url = null`, `threecplus_base_url = https://assessoria.3c.fluxoti.com/api/v1`
  - `phone_extensions` id `31`: já tem `threecplus_sip_domain = assessoria.3c.fluxoti.com`, `threecplus_sip_username = SD9uLTKkWr` e senha salva
  - `threecplus_raw.data.webphone = false`, enquanto `settings.web_extension = true`
- Onde entra o “SIP assessoria”: no `threecplus-proxy`, o fluxo ainda deriva o domínio do SIP a partir de `threecplus_base_url` e também reutiliza `telephony_id/extension_password` do cadastro inicial antes de obrigar o login oficial do webphone.

Causa raiz

1. O `get_sip_credentials` ainda aceita credenciais “fallback” do cadastro inicial (`threecplus_raw.telephony_id` + `extension_password`) e/ou cache antigo antes de buscar o endpoint oficial `POST /agent/webphone/login`.
2. Quando isso acontece, o sistema monta WSS no host do tenant (`assessoria...`), que não está respondendo para WebRTC/SIP no browser.
3. O diagnóstico administrativo também pode mascarar o problema porque o `validate_sip` prioriza valores antigos de `config/ext` antes do retorno oficial do login.
4. A tela de configuração 3C+ ainda força um default de WebSocket, o que pode reintroduzir override incorreto em salvamentos futuros.

Plano de correção

1. Corrigir a prioridade do fluxo SIP no `threecplus-proxy`
- Em `get_sip_credentials`, para 3C+:
  - tentar primeiro `POST /agent/webphone/login` com o token do agente
  - extrair do retorno oficial: `sip_server/domain/host`, `sip_user/username/extension`, `sip_password/password`, e `websocket/ws_url` se existir
  - persistir essas credenciais como cache oficial
- Só usar `threecplus_raw.telephony_id` e `extension_password` como último fallback de emergência, nunca como caminho principal.

2. Parar de derivar SIP do `threecplus_base_url` como caminho normal
- Remover a lógica que hoje transforma `https://assessoria.3c.fluxoti.com/api/v1` em domínio SIP padrão.
- O host do tenant deve servir apenas para API, não como origem principal do SIP/WSS.

3. Persistir e reutilizar corretamente o retorno oficial
- Salvar no ramal o cache vindo do login oficial.
- Salvar também a origem do cache dentro do JSON bruto do ramal (ex.: `last_webphone_login`) para diferenciar cache oficial de fallback antigo, sem precisar nova tabela.
- Se o login oficial retornar `websocket/ws_url`, usar esse valor literalmente; se não retornar, derivar candidatos a partir do `sip_server` oficial, não do tenant.

4. Ajustar o `validate_sip`
- Fazer o diagnóstico resolver nesta ordem:
  1. login oficial
  2. cache oficial
  3. fallback raw
- Exibir separadamente:
  - `webphone`
  - `settings.web_extension`
  - `sip_server` retornado pelo login
  - `websocket/ws_url` retornado pelo login
  - `source` da credencial usada
- Assim, se ainda falhar, ficará claro se o problema restante é API/permissão da 3C+ ou transporte PBX.

5. Corrigir a tela de configuração 3C+
- Em `ConfigTab.tsx`, deixar `threecplus_ws_url` realmente opcional/vazio.
- Remover o default fixo `wss://events.3c.fluxoti.com/ws/me` do formulário 3C+, porque ele não representa o WSS do ramal SIP.
- Manter override manual apenas quando o admin preencher explicitamente.

6. Limpeza secundária de UI
- Ajustar `Badge` para `forwardRef`, eliminando o warning atual no `DiscadorTab`.
- Isso não corrige o SIP, mas limpa o console para facilitar a validação.

Arquivos a alterar

- `supabase/functions/threecplus-proxy/index.ts`
- `src/pages/admin/telefonia/components/ConfigTab.tsx`
- `src/components/ui/badge.tsx`

Validação esperada após implementar

1. Em `/telefonia`, o request `get_sip_credentials` deve parar de responder com:
- `domainSource: derivado de threecplus_base_url`
2. O diagnóstico deve passar a mostrar algo como:
- origem = `3C+ webphone login`
- domínio SIP = valor retornado pelo login oficial
- WebSocket = valor retornado pelo login oficial ou derivado do `sip_server` oficial
3. Se ainda houver falha, o erro residual deixará de ser “tentativa cega em assessoria...” e passará a ser um erro específico do login oficial da 3C+, o que permitirá fechar o caso com precisão.

Detalhes técnicos

- Problema principal atual no código:
  - `supabase/functions/threecplus-proxy/index.ts` usa cache/raw cedo demais
  - por isso o browser recebe `assessoria.3c.fluxoti.com` e faz autodiscovery inteiro no host errado
- Problema secundário:
  - `ConfigTab.tsx` ainda empurra um WSS default que pode contaminar novas tentativas
- Problema não bloqueante:
  - `src/components/ui/badge.tsx` não usa `forwardRef`, gerando warning no painel de telefonia
