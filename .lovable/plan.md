

## Plano: Corrigir Criação de Instância e QR Code UaZapi

### Problema Raiz

Duas falhas identificadas:

1. **Instância nunca é criada no servidor UaZapi** — O wizard salva `QUEUE_2_cfbd247e` no banco, mas nunca chama a API da UaZapi para criar a instância de fato. Sem instância real, não há como gerar QR Code.

2. **Token retorna 401** — O token armazenado está sendo rejeitado pela API. Provavelmente porque a instância não existe no servidor, ou o token precisa ser o admin token do servidor (secret `UAZAPI_ADMIN_TOKEN`) ao invés do token armazenado no provedor.

### Solução

#### 1. Nova Edge Function: `uazapi-instance-manager`

Criar uma edge function server-side que gerencia o ciclo de vida das instâncias UaZapi, usando o `UAZAPI_ADMIN_TOKEN` do servidor (secret seguro):

- **Ação `create`**: Chama `POST /instance/create` na API UaZapi para criar a instância real, passa o nome da instância e recebe o token específico da instância. Salva o token retornado na fila (`queues.evo_apikey`).
- **Ação `connect`**: Chama `POST /instance/connect` para gerar QR Code.
- **Ação `status`**: Chama `GET /instance/status` para verificar conexão e obter QR Code.
- **Ação `disconnect`**: Chama `DELETE /instance/logout` para desconectar.

Usa `UAZAPI_BASE_URL` e `UAZAPI_ADMIN_TOKEN` dos secrets do servidor — nunca expõe o admin token ao frontend.

#### 2. Atualizar `queue-management` (ação `create`)

Após criar a fila no banco, chamar `uazapi-instance-manager` com ação `create` para:
- Criar a instância real na UaZapi
- Obter o token da instância
- Atualizar `queues.evo_apikey` com o token real da instância

#### 3. Atualizar `QueueQRCodeDialog` e `UazapiInstanceStatus`

Mudar as chamadas de `uazapi-proxy` para `uazapi-instance-manager`:
- **Conectar**: `POST uazapi-instance-manager { action: 'connect', queue_id }` — a edge function busca credenciais do banco e chama a API
- **Status**: `POST uazapi-instance-manager { action: 'status', queue_id }`
- **Desconectar**: `POST uazapi-instance-manager { action: 'disconnect', queue_id }`

Isso elimina a necessidade de enviar tokens do frontend e centraliza a lógica no servidor.

### Arquivos

| Tipo | Arquivo |
|------|---------|
| Novo | `supabase/functions/uazapi-instance-manager/index.ts` |
| Editado | `supabase/functions/queue-management/index.ts` (chamar create da instância) |
| Editado | `src/pages/agente/filas/components/QueueQRCodeDialog.tsx` |
| Editado | `src/pages/agente/filas/components/UazapiInstanceStatus.tsx` |
| Editado | `src/pages/agente/filas/components/QueueCard.tsx` (simplificar props) |

### Detalhes Técnicos

- A edge function `uazapi-instance-manager` usa `UAZAPI_ADMIN_TOKEN` e `UAZAPI_BASE_URL` dos secrets do Deno
- Busca os dados da fila pelo `queue_id` no banco (sem enviar credenciais do frontend)
- O frontend passa apenas `queue_id` — toda autenticação fica server-side
- O QR Code é retornado como base64 pela edge function
- Endpoints UaZapi esperados: `POST /instance/create`, `POST /instance/connect`, `GET /instance/status`, `DELETE /instance/logout/{name}`

