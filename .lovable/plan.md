
Diagnóstico confirmado

- Hoje o sistema não está tentando conectar o ramal 3C+ usando `assessoria.3c.fluxoti.com` como SIP.
- No banco, a configuração ativa do agente `202601003` está assim:
  - `threecplus_base_url = https://assessoria.3c.fluxoti.com/api/v1`
  - `sip_domain = pbx01.3c.fluxoti.com`
  - `threecplus_ws_url = wss://pbx01.3c.fluxoti.com:8089/ws`
- O ramal 3C+ ativo também já está cacheado com `threecplus_sip_domain = pbx01.3c.fluxoti.com`.
- O `threecplus-proxy` monta as credenciais SIP a partir desses campos e o `PhoneContext` apenas consome o retorno. Ou seja: a escolha do host SIP/WSS está vindo da configuração/back-end, não do componente React do discador.
- O erro atual (`WebSocket 1006`) acontece antes do registro SIP. Isso indica falha na camada WSS/WebRTC: endpoint incorreto, WebRTC/WSS não habilitado no tenant, TLS/origin bloqueado, ou acesso SIP WebRTC não provisionado pela 3C.

Onde entra o “assessoria”

- `assessoria.3c.fluxoti.com` entra hoje como URL base da API/tenant (`threecplus_base_url`).
- Ele também é usado no código que monta a URL oficial `/extension?...`.
- E aparece como placeholder no campo “Domínio SIP” da tela admin, o que é confuso.
- No fluxo SIP ativo atual, o host em uso é `pbx01.3c.fluxoti.com`, não `assessoria.3c.fluxoti.com`.

Plano de correção

1. Corrigir a modelagem visual da configuração 3C+
- Separar claramente na tela:
  - URL da API/Tenant
  - Domínio SIP/PBX
  - URL WSS do PBX
- Remover o placeholder `assessoria.3c.fluxoti.com` do campo SIP.
- Explicar no formulário que tenant/API e SIP/WSS podem ser hosts diferentes.

2. Expor a origem real das credenciais no diagnóstico
- Ajustar `threecplus-proxy` para retornar também:
  - `baseUrl`
  - origem do SIP domain
  - origem do WS URL
  - domínio salvo na extensão
  - domínio salvo na configuração
- Mostrar isso no “Diagnóstico SIP” da `/telefonia`.

3. Parar de sobrescrever credencial boa com configuração manual
- Hoje `config.sip_domain` tem prioridade sobre o domínio cacheado/retornado.
- Ajustar para priorizar o domínio real vindo do login/credencial do provedor, usando `config.sip_domain` só como override avançado.

4. Adicionar uma validação administrativa da 3C+
- Criar uma ação de “Validar 3C+” para comparar:
  - host SIP retornado pela 3C
  - host SIP salvo
  - WSS salvo
- Isso deve gerar um diagnóstico objetivo sem depender do navegador.

5. Fechar o bloqueio externo com evidência técnica
- Se a validação confirmar que `pbx01.3c.fluxoti.com:8089/ws` é mesmo o endpoint correto e o browser continuar no `1006`, o bloqueio restante é da infraestrutura da 3C/PBX:
  - WSS/WebRTC não habilitado para o tenant
  - porta/path diferentes
  - certificado/TLS/origin não aceitos
  - serviço SIP WebRTC do tenant não provisionado

Arquivos principais

- `supabase/functions/threecplus-proxy/index.ts`
- `src/pages/admin/telefonia/components/ConfigTab.tsx`
- `src/pages/telefonia/components/DiscadorTab.tsx`
- `src/contexts/PhoneContext.tsx`

Resultado esperado

- Fica claro no sistema que `assessoria` é URL de tenant/API e que o SIP/WSS atual vem de `pbx01`.
- O diagnóstico passa a mostrar exatamente de onde o sistema tirou cada valor.
- Se ainda falhar, a evidência técnica fica suficiente para cobrar da 3C a liberação correta do acesso WebRTC/SIP.
