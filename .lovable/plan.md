

# Telefonia Api4Com — O que falta para funcionar de verdade

O módulo tem a estrutura (tabelas, edge functions, UI) mas falta a integração real: criação automática de ramais na Api4Com e o softphone SIP para fazer/receber chamadas no navegador.

## O que já existe
- Tabelas: `phone_config`, `phone_extensions`, `phone_user_plans`, `phone_extension_plans`, `phone_call_logs` (com status)
- Edge functions: `api4com-proxy` (dial, list, create, update, delete, setup_webhook, get_account) e `api4com-webhook` (channel-create/answer/hangup)
- UI: páginas admin e usuário com tabs (ramais, discador, histórico, relatórios)

## O que falta (5 partes)

### 1. Migração — colunas SIP na tabela `phone_extensions`
- Adicionar `api4com_ramal` (text nullable) — número real atribuído pela Api4Com
- Adicionar `api4com_password` (text nullable) — senha SIP para conexão WebRTC

### 2. Edge Function `api4com-proxy` — criar ramal via API real
- Alterar ação `create_extension` para chamar `POST /extensions/nextAvailable` com `{ first_name, last_name, email_address, gravar_audio: 1 }`
- Retornar `{ ramal, senha, id }` da Api4Com para salvar no banco
- Adicionar ação `hangup` → `POST /calls/hangup`
- Adicionar ação `get_sip_credentials` → retorna domínio + ramal + senha para o frontend conectar o softphone

### 3. Softphone SIP com `sip.js`
- Instalar `sip.js` (npm)
- Criar `src/pages/telefonia/hooks/useSipPhone.ts`:
  - Conecta via `wss://dominio.api4com.com:6443`
  - Gerencia estados: `idle → registering → registered → calling → ringing → in-call → error`
  - Expõe: `call()`, `answer()`, `hangup()`, `mute()`, `hold()`, `sendDTMF()`, `duration`
  - Auto-atende chamadas com header `X-Api4comintegratedcall`
- Criar `src/pages/telefonia/components/SoftphoneWidget.tsx`:
  - Widget flutuante (canto inferior direito) com badge de status colorido
  - Teclado DTMF durante chamada, botões mute/hold/hangup
  - Timer de duração em tempo real
  - Minimizável

### 4. Fluxo de criação de ramal (`RamalDialog.tsx` + `useTelefoniaData.ts`)
- Na criação: remover campo "Número do Ramal" (Api4Com define automaticamente)
- Pedir apenas: Nome/Apelido + Membro da equipe
- Ao salvar: chamar `api4com-proxy` → `create_extension` → receber ramal/senha → salvar no banco com `extension_number` (alias exibido, ex: "Ramal 1") + `api4com_ramal` (real) + `api4com_password`
- Na edição: mostrar ramal local e ramal Api4Com (readonly)

### 5. Discador e CRM integrados ao Softphone
- `DiscadorTab.tsx`: ao selecionar ramal, carregar credenciais SIP e registrar softphone. Discar via SIP.js (WebRTC). Mostrar status em tempo real (tocando, em chamada, ocupado). Fallback para API REST se SIP falhar.
- `PhoneCallDialog.tsx` (CRM): mesma lógica — usa softphone se registrado, senão API REST
- Status visual: badge verde (registrado), amarelo (discando/tocando), vermelho (erro), cinza (offline)

## Ordem de execução
1. Migração (api4com_ramal, api4com_password)
2. Atualizar api4com-proxy (create via nextAvailable, hangup, get_sip_credentials)
3. npm install sip.js
4. Criar useSipPhone hook
5. Criar SoftphoneWidget
6. Atualizar RamalDialog (sem número manual)
7. Atualizar useTelefoniaData (fluxo create real)
8. Atualizar DiscadorTab + PhoneCallDialog (integrar softphone)

## Detalhes técnicos

### Conexão SIP (useSipPhone.ts)
```text
UserAgent → wss://dominio:6443
  ├─ Registerer (se registra no servidor)
  ├─ Inviter (faz chamada outbound)
  └─ Session (gerencia chamada ativa)
     ├─ onProgress → status: ringing
     ├─ onAccepted → status: in-call, start timer
     └─ onTerminated → status: idle, log duration
```

### Endpoint create_extension (api4com-proxy)
```text
POST /extensions/nextAvailable
Body: { first_name, last_name, email_address, gravar_audio: 1 }
Response: { id, ramal: "1047", senha: "PwDLooL", domain, bina }
```

