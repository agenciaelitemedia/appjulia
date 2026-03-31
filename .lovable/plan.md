

# Diagnóstico de Permissões do Token 3C+

## Resumo

Adicionar uma nova action `diagnose_token` ao `threecplus-proxy` que testa endpoints-chave da API 3C+ e retorna um mapa de permissões, sem lançar erro se algum endpoint retornar 403.

## Implementação

### Arquivo: `supabase/functions/threecplus-proxy/index.ts`

Adicionar novo case no switch (após o bloco de config, antes do default):

```typescript
case 'diagnose_token': {
  const endpoints = [
    { name: 'users_list',     method: 'GET',  path: '/users?per_page=1' },
    { name: 'agents_list',    method: 'GET',  path: '/agents?per_page=1' },
    { name: 'webphone_login', method: 'POST', path: '/agent/webphone/login', body: { agent_id: 0 } },
    { name: 'campaigns_list', method: 'GET',  path: '/campaigns?per_page=1' },
  ];

  const results: Record<string, { status: number; ok: boolean; detail?: string }> = {};

  for (const ep of endpoints) {
    try {
      const separator = ep.path.includes('?') ? '&' : '?';
      const url = `${baseUrl}${ep.path}${separator}api_token=${token}`;
      const headers: Record<string, string> = { 'Accept': 'application/json' };
      const fetchOpts: RequestInit = { method: ep.method, headers };
      if (ep.body) {
        headers['Content-Type'] = 'application/json';
        fetchOpts.body = JSON.stringify(ep.body);
      }
      const res = await fetch(url, fetchOpts);
      const text = await res.text();
      results[ep.name] = {
        status: res.status,
        ok: res.ok,
        detail: res.ok ? undefined : text.substring(0, 200),
      };
    } catch (err) {
      results[ep.name] = { status: 0, ok: false, detail: String(err).substring(0, 200) };
    }
  }

  result = {
    token_prefix: token.substring(0, 10) + '...',
    base_url: baseUrl,
    cod_agent: codAgent,
    permissions: results,
    summary: Object.entries(results).map(([k, v]) => `${k}: ${v.ok ? '✅' : '❌'} (${v.status})`).join(', '),
  };
  break;
}
```

## Resultado Esperado

Chamando com `{ action: 'diagnose_token', codAgent: '202601003' }`, retorna:

```json
{
  "token_prefix": "57nwW8YhKU...",
  "base_url": "https://app.3c.fluxoti.com/api/v1",
  "permissions": {
    "users_list":     { "status": 200, "ok": true },
    "agents_list":    { "status": 200, "ok": true },
    "webphone_login": { "status": 403, "ok": false, "detail": "..." },
    "campaigns_list": { "status": 200, "ok": true }
  },
  "summary": "users_list: ✅ (200), agents_list: ✅ (200), webphone_login: ❌ (403), campaigns_list: ✅ (200)"
}
```

Isso permite identificar exatamente quais permissões o token possui sem precisar testar cada operação individualmente.

