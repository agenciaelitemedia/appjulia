## Correção do registro + fix da marcação errada de direção

### 1. Corrigir o registro atual

Atualizar a linha `aaf7a907-2fcc-43c2-b5b6-65ab5aa32d52` (WhatsApp Call ID `15EFBE841B2F362D11787D5E3C3F4576`) em `wavoip_call_logs`:

- `direction`: `inbound` → `outbound`
- `from_number`: `558499506625` → `553488860163` (dispositivo "Meu Atendimento" que originou)
- `to_number`: `null` → `558499506625` (número chamado)
- `metadata.corrected_manually = true`

### 2. Corrigir a causa raiz no webphone (`src/contexts/WavoipContext.tsx`)

Hoje o `upsertCallLog` decide `direction` a partir do payload do SDK e cai em `inbound` sempre que `rawDir` contém "in" (inclui `incoming`, mas também qualquer string com "in"). Além disso, `payload.from` é usado direto como `from_number` — em `call:ended` de chamada feita, o SDK às vezes envia `from = número do outro lado`, invertendo os papéis.

Ajustes:

- **Travar a direção pela primeira vez que a chamada é vista**:
  - `dial(...)` já grava a linha com `direction: 'outbound'` — passar a guardar `direction: 'outbound'` no `activeCall` e no cache `currentCallByToken` (virar `Map<token, { id, direction }>`).
  - `offer:received` → `direction: 'inbound'` (também travado no cache).
  - Nos eventos seguintes (`call:accepted`, `call:ended`), **ignorar** `payload.direction` e usar a direção travada. Fallback só se não houver nada travado.
- **Derivar from/to a partir da direção travada, não de `payload.from/to`**:
  - `outbound` → `from_number = whatsapp_number do dispositivo`, `to_number = peer/digits`
  - `inbound`  → `from_number = peer`, `to_number = whatsapp_number do dispositivo`
  - Buscar `whatsapp_number` uma vez em `resolveDeviceId` (retornar `{ id, whatsapp_number }`).
- **Manter `wavoip-fetch-call-details` como fonte oficial**: ele já roda no `call:ended` e sobrescreve `direction`/`from_number`/`to_number` com os dados oficiais da API Wavoip — reforçar isso removendo o `?? existingLog?.from_number` quando a API traz valor, para garantir correção pós-fato de qualquer linha nova.

### Fora de escopo

- Não mexer no webhook oficial (`wavoip-call-webhook`) — ele já usa `caller/receiver` da própria Wavoip e não tem esse bug.
- Não reprocessar chamadas antigas em massa; apenas a linha citada é corrigida manualmente.
