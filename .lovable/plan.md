
# Plano: Correção do Erro 405 ao Excluir Instância

## Diagnóstico

O erro **500 Internal Server Error** ocorre porque a API UaZapi retorna **405 Method Not Allowed**. A causa é que o endpoint usado está incorreto:

| Atual (incorreto) | Correto (Evolution API) |
|-------------------|------------------------|
| `DELETE /admin/instance/{instance}` | `DELETE /instance/delete/{instance}` |
| Header: `admintoken` | Header: `apikey` (token da instância) |

## Problema Identificado

A UaZapi/Evolution API utiliza dois tipos de autenticação:
1. **`admintoken`** - Para criar instâncias (`/instance/init`)
2. **`apikey`** - Para operações específicas de uma instância (deletar, logout, etc.)

Para deletar uma instância, precisamos usar o token específico daquela instância (`apikey`), não o token admin.

## Solução

### Modificação 1: Edge Function `uazapi-admin/index.ts`

Atualizar o case `delete_instance` para:

1. Usar o endpoint correto: `/instance/delete/{instance}`
2. Passar o `apikey` da instância como header (precisamos recebê-lo do frontend)
3. Adicionar fallback: se não tiver apikey, tentar via endpoint admin

```text
Antes:
  DELETE /admin/instance/{instanceName}
  Header: admintoken

Depois:
  DELETE /instance/delete/{instanceName}
  Header: apikey (token da instância)
```

### Modificação 2: Hook `useDeleteInstance.ts`

Incluir o `evo_apikey` da instância na requisição:

```typescript
body: {
  action: 'delete_instance',
  instanceName: agent.evo_instancia,
  agentId: agent.agent_id_from_agents,
  instanceToken: agent.evo_apikey, // Adicionar token da instância
},
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/uazapi-admin/index.ts` | Corrigir endpoint e headers no `delete_instance` |
| `src/pages/agente/meus-agentes/hooks/useDeleteInstance.ts` | Enviar `evo_apikey` junto com a requisição |

## Detalhes Técnicos

### Edge Function - Novo código para delete_instance:

```typescript
case 'delete_instance': {
  const { instanceName, agentId, instanceToken } = params;
  
  if (!instanceName) {
    throw new Error('Missing required parameter: instanceName');
  }

  console.log('Deleting instance:', instanceName);
  
  // Delete instance from UaZapi usando o endpoint correto
  const deleteResponse = await fetch(
    `${UAZAPI_BASE_URL}/instance/delete/${encodeURIComponent(instanceName)}`, 
    {
      method: 'DELETE',
      headers: {
        'apikey': instanceToken || UAZAPI_ADMIN_TOKEN,
      },
    }
  );

  // ... resto do código permanece igual
}
```

### Hook - Incluir token:

```typescript
const { data, error } = await supabase.functions.invoke('uazapi-admin', {
  body: {
    action: 'delete_instance',
    instanceName: agent.evo_instancia,
    agentId: agent.agent_id_from_agents,
    instanceToken: agent.evo_apikey, // Token da instância
  },
});
```

## Fluxo Atualizado

```text
Frontend (useDeleteInstance)
    │
    ▼
Edge Function (uazapi-admin)
    │
    ├─► DELETE /instance/delete/{name}
    │   Header: apikey = instanceToken
    │
    ▼
UaZapi API
    │
    ▼
Limpa credenciais no banco de dados
```

## Verificação

Após implementação, testar:
1. Clicar em "Excluir Instância" no card de um agente
2. Verificar se a exclusão é concluída com sucesso
3. Confirmar que os campos `hub`, `evo_url`, `evo_apikey`, `evo_instance` são limpos no banco
