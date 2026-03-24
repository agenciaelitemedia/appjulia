

# Corrigir erro "(#100) Missing Permission" no fluxo WABA

## Causa raiz

O token gerado pelo Embedded Signup (coexistência) é um **System User Token** com escopo limitado ao WABA. Ele **não tem permissão** para chamar `/me/businesses`, que é um endpoint de token pessoal. Por isso o `fetch_waba_info` falha com `(#100) Missing Permission`.

O `waba_id` e `phone_number_id` **já deveriam vir** do evento `WA_EMBEDDED_SIGNUP` (via `postMessage`), mas no caso de coexistência com `sessionInfoVersion: 3`, esses dados podem não ser retornados no evento FINISH — ou o callback do `FB.login` pode disparar antes do `message` event chegar.

## Solucao

Duas alteracoes:

### 1. Edge Function (`waba-admin`): usar endpoint correto para System User Token

Trocar a chamada `/me/businesses` por endpoints que o System User Token tem permissao:
- `GET /v22.0/debug_token?input_token={token}` para descobrir o WABA ID associado ao token
- Ou usar diretamente `GET /v22.0/{waba_id}/phone_numbers` quando o waba_id ja estiver disponivel

A funcao `resolveWabaInfoFromToken` sera reescrita para:
1. Chamar `debug_token` com o app token (`META_APP_ID|META_APP_SECRET`) para inspecionar o user token e extrair os granular scopes/WABA ID
2. Se nao conseguir o WABA ID via debug_token, tentar `GET /v22.0/me?fields=id` e depois usar shared WABAs
3. Listar phone numbers do WABA encontrado

### 2. Frontend (`WabaSetupDialog.tsx`): garantir captura do sessionInfo

Adicionar um pequeno delay ou promise para aguardar o `message` event antes de chamar `processSignup`, pois o callback do `FB.login` pode disparar antes do evento `WA_EMBEDDED_SIGNUP` com os dados. Isso reduz a necessidade de fallback no servidor.

- Criar uma Promise que resolve quando o `message` event FINISH chegar (com timeout de 5s)
- Aguardar essa Promise antes de chamar `processSignup`
- Se os dados ja estiverem no ref, pular o `fetch_waba_info` no servidor

## Arquivos alterados

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/waba-admin/index.ts` | Reescrever `resolveWabaInfoFromToken` para usar `debug_token` em vez de `/me/businesses` |
| `src/pages/agente/meus-agentes/components/WabaSetupDialog.tsx` | Aguardar sessionInfo antes de processar signup |

