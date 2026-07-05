## Objetivo

No webphone Wavoip, a tela de discagem mostra "Ligando de {UUID}" porque o SDK exibe o **nome do dispositivo cadastrado no backend Wavoip** — não o `callSettings.displayName` da nossa `render()` nem o `device_name` local. Precisamos empurrar o `device_name` que o usuário define em `/wavoip` para o endpoint `PUT /v2/devices/:id_device/name` do Wavoip, para que o próprio widget mostre o nome amigável em todas as chamadas (inclusive as iniciadas dentro do widget nativo, que não passam pelo nosso `startCall`).

## Referência da API

- Docs confirmam: `callSettings.displayName` é fixado no `render()` e `call.start(to, { displayName })` sobrescreve por chamada. Não existe API runtime para renomear o dispositivo pelo webphone.
- Renomeação oficial: `PUT {api_base}/v2/devices/:id_device/name` com body `{ name }` (Wavoip V2, autenticado com o JWT do provider — já usado em `wavoip-device-provision`).

## Mudanças

### 1) Nova edge function `wavoip-rename-device`
- Body: `{ device_id: uuid }` (id em `wavoip_devices`).
- Fluxo:
  1. Carrega `wavoip_devices` (com `provider_id`, `wavoip_device_id`, `device_name`).
  2. Carrega `wavoip_providers` e garante JWT via `wavoipLogin` (mesmo padrão de `wavoip-device-provision`; refresh em 401).
  3. Chama `PUT /v2/devices/{wavoip_device_id}/name` com `{ name: device_name }`. Se `device_name` estiver vazio, usa fallback `WAPhone_{friendly_code}`.
  4. Persiste `wavoip_raw.name` e `metadata.last_rename_at` em `wavoip_devices`.
  5. Retorna `{ ok: true, wavoip_name }`.
- CORS + validação Zod, sem exposição de secrets.

### 2) Disparo automático quando o usuário nomeia/renomeia o dispositivo
- `src/pages/wavoip/WavoipPage.tsx` → `handleClaim` (linha 262): logo após `update({ device_name })`, invocar `supabase.functions.invoke('wavoip-rename-device', { body: { device_id: updated.id } })` (fire-and-forget com `.catch` silencioso; toast só em erro explícito).
- Também disparar após qualquer futura edição de `device_name` (a página hoje só cria; se houver botão de renomear, adiciona-se o mesmo invoke).

### 3) Provisionamento inicial já correto
- Em `wavoip-device-provision`, o nome enviado no `buy-device` é `JU_{client_id}_{device_name}`. Vamos manter (nome interno técnico), mas **imediatamente após inserir** em `wavoip_devices`, chamar o mesmo `PUT /v2/devices/:id/name` com o `device_name` puro (o que o usuário digitou) — assim o widget mostra "Ligando de {device_name}" desde a primeira ligação, sem depender do rename posterior.

### 4) `WavoipContext.startCall` já passa `displayName = device.name`
- Nenhuma mudança necessária lá. Serve como reforço quando a chamada é iniciada pela nossa UI; o `PUT` acima cobre o caso do discador nativo do widget.

### 5) Backfill único
- Script (executado via `supabase--insert` + invoke em loop): para todo `wavoip_devices` com `wavoip_device_id IS NOT NULL` e `device_name IS NOT NULL`, invocar `wavoip-rename-device` para alinhar o backend Wavoip aos nomes atuais.

## Arquivos

- **Criar** `supabase/functions/wavoip-rename-device/index.ts`
- **Editar** `supabase/functions/wavoip-device-provision/index.ts` (chamar rename após insert)
- **Editar** `src/pages/wavoip/WavoipPage.tsx` (invoke após `handleClaim`)
- **Backfill** (execução pontual, sem código versionado)

## Fora do escopo
- Nenhuma mudança no SDK do webphone, no `callSettings.displayName` global, ou nas tabelas.
