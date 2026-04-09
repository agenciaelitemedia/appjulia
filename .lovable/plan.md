

# Corrigir listagem de grupos — dados completos via proxy

## Problema

Dois problemas:
1. O endpoint `/group/list` retorna apenas dados mínimos (id, subject) sem participantes, foto ou tamanho
2. A chamada é feita diretamente do browser para a API UaZapi, o que pode sofrer bloqueio CORS

## Solução

Alterar `SupportGroupsTab.tsx` para:

1. **Usar o proxy** (`uazapi-proxy` edge function) em vez de fetch direto, evitando CORS
2. **Trocar endpoint** para `/group/fetchAllGroups` com `getParticipants=true` no body — este é o endpoint da Evolution API que retorna dados completos (foto, participantes, descrição, etc.)
3. **Fallback**: se `/group/fetchAllGroups` falhar, tentar `/group/list` e depois buscar info individual via `/group/info` para cada grupo
4. **Mapear campos** corretamente da resposta da API (pode vir como `groupMetadata`, `profilePictureUrl`, `participants`, etc.)

## Mudança técnica

```typescript
// Antes: fetch direto
const resp = await fetch(`${apiUrl}/group/list`, { headers: { token } });

// Depois: via proxy com endpoint correto
const resp = await fetch(`${supabaseUrl}/functions/v1/uazapi-proxy`, {
  method: "POST",
  headers: { "Content-Type": "application/json", apikey, authorization },
  body: JSON.stringify({
    method: "GET",
    endpoint: "/group/fetchAllGroups?getParticipants=true",
    token: instanceToken,
    baseUrl: apiUrl,
  }),
});
const result = await resp.json();
// result.data contém array de grupos com participantes
```

Também adicionar `console.log` da resposta raw para debug e normalizar os campos (`pictureUrl` / `profilePictureUrl`, `participants`, `size`/`participants.length`).

## Arquivo alterado

| Arquivo | Mudança |
|---|---|
| `SupportGroupsTab.tsx` | Usar proxy, endpoint `/group/fetchAllGroups?getParticipants=true`, normalizar campos da resposta |

