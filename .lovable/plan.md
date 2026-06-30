## Causa

Ao clicar em "Reconectar" em `/wavoip`, o front chama `supabase.functions.invoke('wavoip-connect-device')`. A função existe no código (`supabase/functions/wavoip-connect-device/index.ts`) mas **não está deployada** — chamada direta retorna `404 NOT_FOUND: Requested function was not found`. Por isso o SDK reporta o erro genérico "Failed to send a request to the Edge Function".

O mesmo deve ocorrer com as outras edge functions do Wavoip recém-criadas: `wavoip-provision-device` e `wavoip-call-webhook`.

## Correção

1. **Forçar deploy das edge functions Wavoip** fazendo um toque mínimo (no-op) em cada `index.ts` para o Lovable Cloud reimplantar:
   - `supabase/functions/wavoip-connect-device/index.ts`
   - `supabase/functions/wavoip-provision-device/index.ts`
   - `supabase/functions/wavoip-call-webhook/index.ts`

2. **Endurecer `wavoip-connect-device`** para falhar de forma legível em vez de derrubar a conexão:
   - Envolver o `fetch` da API Wavoip com `AbortController` (timeout ~8s) para não estourar o limite da edge function.
   - Quando a API Wavoip não confirmar números, manter `connection_status = 'connecting'` (em vez de marcar `connected` otimisticamente sem JIDs) — isso evita o discador liberar sem dispositivo real conectado.
   - Retornar mensagem de erro clara (`error: "wavoip_api_unreachable"`) com status 502, preservando CORS.

3. **Melhorar o feedback no front (`WavoipPage.handleConnect`)**:
   - Mostrar `toast.error` com a mensagem retornada pela função (`data?.error` ou `error.message`) em vez de mensagem genérica.
   - Em caso de 404 (function não encontrada), instruir que o módulo Wavoip ainda está sendo provisionado.

## Validação

- Após o redeploy: `POST /functions/v1/wavoip-connect-device` deve responder 401/400 (não 404).
- Clicar "Reconectar" em `/wavoip` deve atualizar o badge para `connecting` → `connected` (ou erro legível).
