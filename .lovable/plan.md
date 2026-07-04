## Problema

O `list` já funcionou (a aba abre vazia), mas ao chamar `create` o cliente recebe **"Failed to send a request to the Edge Function"**. Esse erro do supabase-js aparece quando a função **retorna sem uma resposta HTTP válida** (crash não capturado, boot falhou, ou timeout). Como o handler está inteiro dentro de `try/catch`, o suspeito mais provável é o **fetch para `https://api.wavoip.com/v2/login`** — se a Wavoip demorar/derrubar a conexão, o `fetch` estoura sem timeout e a runtime encerra a função com erro de rede antes de responder.

Sinais:
- `list` (não chama Wavoip) funciona.
- `create` (chama Wavoip antes de responder) falha.
- Não há logs de erro em `wavoip-providers` porque a runtime é encerrada antes do `console.log`.

## Correção

1. **Tornar o login opcional/tolerante a falhas de rede** em `supabase/functions/wavoip-providers/index.ts`:
   - Envolver `wavoipLogin` com `AbortController` + timeout de 10s.
   - Capturar `TypeError` / `AbortError` e retornar `{ ok:false, error }` — **nunca deixar o fetch derrubar a função**.
   - Adicionar `console.log`/`console.error` no início e no fim de cada action para diagnóstico futuro.
2. **Sempre persistir o provedor primeiro** e tentar login depois (para `create` e `update`):
   - Insere o registro com `last_login_status='pending'`.
   - Chama `wavoipLogin`; em qualquer erro persiste `last_login_status='error'` + `last_login_error` e devolve `200` com `warning`.
   - Assim, mesmo se a Wavoip estiver fora, o cadastro conclui e o usuário pode usar "Refazer login" depois.
3. **Redeploy explícito** de `wavoip-providers` após a alteração (`supabase--deploy_edge_functions`) e validar com `supabase--curl_edge_functions` chamando `action:"create"` com credenciais fake para confirmar que a resposta HTTP chega (esperado: `200` com `warning`).
4. **Frontend (`useWavoipProviders.ts`)**: exibir `res.warning` no toast do `useCreateWavoipProvider`/`useUpdateWavoipProvider` para o usuário saber que o token não foi obtido.

## Arquivos alterados

- `supabase/functions/wavoip-providers/index.ts` — timeout + try/catch em `wavoipLogin`, insert-first, logs.
- `src/pages/admin/wavoip/hooks/useWavoipProviders.ts` — propagar `warning`.
- `src/pages/admin/wavoip/components/WavoipProvidersTab.tsx` — mostrar `warning` no toast.

Sem mudanças de schema, sem novos secrets.
