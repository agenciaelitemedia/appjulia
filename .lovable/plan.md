

# Fix SIP WebSocket Connection — Wrong Domain

## Problem
The SIP WebSocket connects to `wss://api.api4com.com:6443` (the REST API host) instead of `wss://atendejulia.api4com.com:6443` (the account's SIP domain). The create_extension response confirms the account domain is `atendejulia.api4com.com`.

## Root Cause
`get_sip_credentials` in `api4com-proxy` uses `config.api4com_domain` (which stores `api.api4com.com`) for both REST and SIP. The SIP WebSocket server runs on the **account domain**, not the API domain.

## Fix

### 1. Migration — add `sip_domain` column to `phone_config`
```sql
ALTER TABLE phone_config ADD COLUMN sip_domain text;
```

### 2. `api4com-proxy` — `get_sip_credentials`
- Use `config.sip_domain` if set, otherwise fallback to extracting domain from the extension's create response stored in DB
- If `sip_domain` is null, try to get it from Api4Com via `GET /account` and save it

### 3. `api4com-proxy` — `create_extension`
- After successful creation, if `config.sip_domain` is null, save the `domain` from the response (`atendejulia.api4com.com`) to `phone_config.sip_domain`

### 4. Admin `ConfigTab.tsx`
- Add optional field "Domínio SIP" alongside existing domain field
- Auto-populated from create_extension but editable

### 5. Quick fix alternative (simpler)
Instead of a new column, just change `get_sip_credentials` to use the account domain pattern. Since the REST domain is `api.api4com.com` but the response from create_extension shows `atendejulia.api4com.com`, we can:
- Store the SIP domain from create_extension response in a new `phone_config.sip_domain` column
- OR: hardcode extraction from the create response's `domain` field already stored

**Recommended approach**: Add `sip_domain` to `phone_config` + auto-populate from create_extension. Change `get_sip_credentials` to use `sip_domain || config.api4com_domain`.

## Files changed
- Migration: add `sip_domain` to `phone_config`
- `supabase/functions/api4com-proxy/index.ts`: update `get_sip_credentials` and `create_extension`
- `src/pages/admin/telefonia/components/ConfigTab.tsx`: add SIP domain field

