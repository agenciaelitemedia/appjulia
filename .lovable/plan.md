

# Correção do erro 401 no chat de contratos

## Diagnóstico

O problema está na função `loadAgentCredentials` do `WhatsAppMessagesDialog.tsx`. Ela busca credenciais da view `vw_list_client-agents-users` usando os campos `api_url`, `api_key`, `api_instance`. Porém, esses campos na view estão com valores desatualizados ou mapeiam colunas antigas.

As credenciais válidas do UaZapi estão na tabela `agents` nos campos `evo_url`, `evo_apikey`, `evo_instancia` — como já é feito corretamente no `datajud-monitor` e no `UaZapiContext`.

O token retornado pela view (`3c888ef2-...`) é rejeitado pela API UaZapi com "Invalid token", confirmando que é um token antigo/incorreto.

## Solução

### `WhatsAppMessagesDialog.tsx` — alterar query de credenciais

Trocar a query de:
```sql
SELECT api_url, api_key, api_instance 
FROM "vw_list_client-agents-users" 
WHERE cod_agent = $1
```

Para:
```sql
SELECT evo_url as api_url, evo_apikey as api_key, evo_instancia as api_instance 
FROM agents 
WHERE cod_agent = $1 AND evo_url IS NOT NULL
LIMIT 1
```

Isso busca diretamente da tabela `agents` os campos corretos e válidos, usando aliases para manter compatibilidade com o restante do código (interface `AgentCredentials`).

## Arquivo alterado
| Arquivo | Ação |
|---|---|
| `src/pages/crm/components/WhatsAppMessagesDialog.tsx` | Alterar query na função `loadAgentCredentials` |

