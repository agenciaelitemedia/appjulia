## Contexto

O painel da 3C+ exibe o "Ramal SIP externo" do agente `218637` com:

- Servidor SIP: `assessoria.3c.fluxoti.com` (subdomínio do tenant)
- Usuário: `B0lse3Z0EV`
- Senha: `pYWWebrY0f`

Hoje o sistema tenta obter essas credenciais automaticamente via `/agent/webphone/login`, mas a 3C+ retorna **403 (sem licença de Webphone)** para esse agente. O fallback genérico então usa `pbx01.3c.fluxoti.com`, que é o **domínio errado** — por isso o REGISTER falha com "Authentication Error" mesmo com WebSocket conectado.

A correção definitiva ideal é habilitar a licença Webphone no painel 3C+. Como isso depende do cliente/comercial 3C+, vamos adicionar um caminho de **credenciais manuais** que funciona imediatamente com os dados do painel.

## O que vai mudar

### 1. Banco de dados (migração)

Adicionar 3 colunas opcionais em `phone_extensions` para armazenar as credenciais SIP manuais informadas pelo painel da 3C+:

- `sip_manual_domain` (text, null)
- `sip_manual_username` (text, null)
- `sip_manual_password` (text, null)

Quando preenchidas, têm **prioridade máxima** sobre login oficial e fallback.

### 2. UI — tela de Telefonia (`/telefonia`)

Adicionar, na linha de cada ramal 3C+, um botão **"Credenciais SIP manuais"** que abre um modal com 3 campos:

- Servidor SIP (ex.: `assessoria.3c.fluxoti.com`)
- Usuário do ramal (ex.: `B0lse3Z0EV`)
- Senha do ramal (ex.: `pYWWebrY0f`)

Texto auxiliar explicando: "Use estes campos quando o login automático falhar (403). Copie os valores exatamente como aparecem no painel da 3C+ em 'Ramal SIP externo'."

### 3. Edge Function `threecplus-proxy` — ação `get_sip_credentials`

Nova ordem de prioridade:

1. **PRIORITY 1 (nova)** — se `phone_extensions.sip_manual_*` estiverem preenchidos, retornar essas credenciais direto (com `wsUrl = wss://vox-socket.3c.fluxoti.com:4443/ws`, que é o WS oficial da 3C+).
2. PRIORITY 2 — login oficial via `/agent/webphone/login` (atual).
3. Fallback genérico — **continua desabilitado** (já corrigido em mensagens anteriores). Se 1 e 2 falharem, retorna `blocked: true, nonRetryable: true` com mensagem orientando preencher as credenciais manuais OU habilitar licença na 3C+.

### 4. Frontend `PhoneContext.tsx`

Manter o tratamento atual de `blocked: true`, mas atualizar a mensagem do toast para sugerir as duas saídas:

> "Webphone 3C+ sem licença automática. Preencha 'Credenciais SIP manuais' no ramal ou habilite a licença no painel 3C+."

## Detalhes técnicos

**Migração SQL:**

```sql
ALTER TABLE public.phone_extensions
  ADD COLUMN IF NOT EXISTS sip_manual_domain text,
  ADD COLUMN IF NOT EXISTS sip_manual_username text,
  ADD COLUMN IF NOT EXISTS sip_manual_password text;
```

RLS atual de `phone_extensions` já cobre — não precisa policy nova.

**`threecplus-proxy/index.ts` (`get_sip_credentials`):**

```ts
// PRIORITY 1: manual credentials from phone_extensions
const { data: ext } = await supabase
  .from('phone_extensions')
  .select('sip_manual_domain, sip_manual_username, sip_manual_password')
  .eq('id', extensionId)
  .maybeSingle();

if (ext?.sip_manual_domain && ext?.sip_manual_username && ext?.sip_manual_password) {
  return {
    domain: ext.sip_manual_domain,
    username: ext.sip_manual_username,
    password: ext.sip_manual_password,
    wsUrl: 'wss://vox-socket.3c.fluxoti.com:4443/ws',
    source: 'manual',
  };
}
// PRIORITY 2: official /agent/webphone/login (existing)
// PRIORITY 3: disabled
```

**UI (`src/pages/telefonia/components/...`):** novo `<Dialog>` com `<Input>` x3 + `<Button>` salvar, chamando `updateExtension` mutation já existente em `useTelefoniaData.ts`.

**Memória:** atualizar `mem://integrations/telephony/threecplus-infrastructure-v5` registrando que credenciais manuais têm prioridade sobre login oficial.

## O que NÃO está incluso

- Habilitar licença Webphone no painel 3C+ (ação manual do cliente fora do app).
- Mudança no fluxo da Api4Com.

## Resultado esperado

Após preencher os 3 campos no ramal do agente `218637` com os dados do painel (`assessoria.3c.fluxoti.com` / `B0lse3Z0EV` / `pYWWebrY0f`), o REGISTER SIP passa a usar o realm correto e o softphone fica registrado sem depender do endpoint `/agent/webphone/login`.
