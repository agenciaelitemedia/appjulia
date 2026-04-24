

## Bug: botão "Desconectar" não desconecta de fato

### Causa raiz (confirmada nos logs e código)
O `uazapi-instance-manager` no case `disconnect` chama:
```ts
DELETE /instance/logout/{instanceName}
```
Isso é **sintaxe da Evolution API**, não da UaZapi. A UaZapi não tem essa rota — o servidor responde 200/404 silencioso (sem ação real), o frontend mostra toast de sucesso, mas a sessão WhatsApp continua viva. Por isso o usuário consegue clicar "Conectar" logo em seguida e voltar como "Mário Castro" **sem escanear QR**.

### Endpoints corretos da UaZapi
- `POST /instance/disconnect` — derruba sessão WS, mantém pareamento
- `POST /instance/logout` — desparear conta (precisa QR na próxima vez)

Sua escolha: **logout completo (desparear)**.

## Correção

### Arquivo: `supabase/functions/uazapi-instance-manager/index.ts`
Reescrever o case `disconnect` para usar o endpoint correto da UaZapi:

```ts
case 'disconnect': {
  if (!queue_id) return respond({ error: 'queue_id required' }, 400);
  const queue = await getQueueCredentials(queue_id);
  const token = queue.evo_apikey || adminToken;
  const url = queue.evo_url || baseUrl;

  console.log(`[uazapi-instance-manager] Logout (unpair): ${queue.evo_instance}`);
  let res = await fetch(`${url}/instance/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'token': token },
  });

  if (res.status === 401 && token !== adminToken) {
    res = await fetch(`${url}/instance/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'admintoken': adminToken },
    });
  }

  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = { response: text }; }
  console.log(`[uazapi-instance-manager] Logout response: ${res.status}`);

  return respond({ success: res.ok, status: res.status, data });
}
```

Mudanças:
- Método: `DELETE` → `POST`
- URL: `/instance/logout/{name}` → `/instance/logout` (UaZapi identifica a instância pelo header `token`)
- Semântica: agora faz logout real — exige QR Code novo na próxima conexão
- Log mais claro indicando "unpair"

### Validação após o deploy
1. Clicar "Desconectar" no `/agente/filas` → toast de sucesso
2. Verificar nos logs: `Logout response: 200` (não mais "Status response")
3. Clicar "Conectar" → deve aparecer **QR Code** (não reconectar automaticamente como antes)
4. Status da instância vai para `disconnected` na UaZapi

## Arquivos afetados
- `supabase/functions/uazapi-instance-manager/index.ts` — case `disconnect` corrigido

## Nada mais precisa mudar
- Frontend (`UazapiInstanceStatus`, `useConnectionActions`) já chama corretamente a action `disconnect` — só estava recebendo resposta enganosa do backend
- Demais funções (`uazapi-history-force-resync`, `_shared/uazapi-adapter.ts`) já usam endpoints corretos

