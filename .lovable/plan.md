

# Fix SIP WebSocket URL for 3C+

## Problem

The SIP client connects to `wss://events.3c.fluxoti.com/ws/me` — this is the 3C+ **events** WebSocket, not a SIP/WebRTC endpoint. It rejects the connection (code 1006) because it doesn't speak SIP.

The correct SIP WebSocket is derived from the SIP domain: `wss://pbx01.3c.fluxoti.com:8089/ws`.

## Root Cause

In `threecplus-proxy/index.ts`, the `get_sip_credentials` action returns `config.threecplus_ws_url` (which holds the events URL) as the SIP WebSocket URL. The `useSipPhone` hook then uses this URL to open its SIP WebSocket — wrong endpoint entirely.

## Fix

### 1. `supabase/functions/threecplus-proxy/index.ts`

In all three code paths of `get_sip_credentials`, construct the SIP WebSocket URL from the SIP domain instead of using `config.threecplus_ws_url`:

```typescript
// BEFORE (3 places):
const wsUrl = config.threecplus_ws_url || `wss://${sipDomain}`;

// AFTER (all 3):
const wsUrl = `wss://${sipDomain}:8089/ws`;
```

This applies to lines ~129, ~157, and ~188.

### 2. `src/pages/admin/telefonia/components/ConfigTab.tsx`

Rename/relabel the `threecplus_ws_url` field to clarify it's for **events**, not SIP. Add a helper tooltip: "URL do WebSocket de eventos 3C+ (não é o WebSocket SIP)". No functional change needed — this field stays for future events integration.

## Technical Detail

- SIP domain: `pbx01.3c.fluxoti.com`
- Correct SIP WS: `wss://pbx01.3c.fluxoti.com:8089/ws` (standard Obexi/Obexa PBX port)
- Events WS: `wss://events.3c.fluxoti.com/ws/me` (3C+ platform events, not SIP)

