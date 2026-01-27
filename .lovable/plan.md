
## Plano: Implementar Funcionalidade Completa de Configurar Instância UaZapi

### Objetivo
Implementar a funcionalidade do botão "Configurar Instância" para criar automaticamente instâncias na UaZapi, configurar webhooks para receber mensagens (ignorando grupos) e salvar as credenciais no banco de dados do agente.

---

## Requisitos Identificados

### 1. Secret Necessário
A UaZapi requer um **admin token** para endpoints administrativos (criar/deletar instâncias). Este token é diferente do token de instância individual.

**Ação necessária**: Adicionar secret `UAZAPI_ADMIN_TOKEN` no projeto.

### 2. URL Base da UaZapi
A URL base do servidor UaZapi (ex: `https://atende-julia.uazapi.com`) precisa estar configurada.

**Ação necessária**: Adicionar secret `UAZAPI_BASE_URL` no projeto.

---

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                           Frontend (React)                              │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  ConnectionControlButtons.tsx                                      │  │
│  │  ├─ status = 'no_config' → Botão "Configurar Instância"           │  │
│  │  └─ onClick → abre ConfigureInstanceDialog                         │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                              │                                           │
│                              ▼                                           │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  ConfigureInstanceDialog.tsx                                       │  │
│  │  ├─ Formulário: Nome da instância (opcional)                      │  │
│  │  ├─ Mostra progresso (3 etapas)                                   │  │
│  │  └─ useConfigureInstance mutation                                  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼ POST /uazapi-admin
┌─────────────────────────────────────────────────────────────────────────┐
│                      Edge Function: uazapi-admin                        │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  action: 'create_instance'                                         │  │
│  │  1. Chama POST /admin/instance (UaZapi) → cria instância          │  │
│  │  2. Obtém token da nova instância                                  │  │
│  │  3. Configura webhook (POST /webhook/set)                          │  │
│  │  4. Atualiza agents no banco de dados                              │  │
│  │  5. Retorna credenciais                                            │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│      UaZapi API          │    │   PostgreSQL (agents)    │
│  POST /admin/instance    │    │  UPDATE agents SET       │
│  POST /webhook/set       │    │    hub = 'uazapi',       │
│                          │    │    evo_url = '...',      │
│                          │    │    evo_apikey = '...',   │
│                          │    │    evo_instancia = '...' │
└──────────────────────────┘    └──────────────────────────┘
```

---

## Arquivos a Criar

### 1. Edge Function: uazapi-admin
**Arquivo**: `supabase/functions/uazapi-admin/index.ts`

Esta Edge Function centralizará todas as operações administrativas da UaZapi:

```typescript
// Endpoints UaZapi Admin (requerem admintoken):
// POST /admin/instance      → Criar instância
// DELETE /admin/instance    → Deletar instância
// GET /admin/instances      → Listar instâncias

// Endpoints de instância (requerem token):
// POST /webhook/set         → Configurar webhook
```

**Ações suportadas**:
- `create_instance`: Cria instância + configura webhook + salva no banco
- `delete_instance`: Remove instância da UaZapi

**Configuração de Webhook**:
```json
{
  "url": "https://webhook-url-do-cliente.com/webhook",
  "events": ["messages.upsert"],
  "webhook_by_events": false,
  "ignore_groups": true,
  "ignore_status": true,
  "ignore_broadcast": true
}
```

### 2. Componente: ConfigureInstanceDialog
**Arquivo**: `src/pages/agente/meus-agentes/components/ConfigureInstanceDialog.tsx`

Dialog modal que:
- Coleta nome opcional da instância (padrão: `[cod_agent] - Nome do cliente`)
- Mostra progresso visual das 3 etapas:
  1. Criando instância...
  2. Configurando webhook...
  3. Salvando credenciais...
- Exibe QR Code automaticamente após conclusão
- Trata erros e permite retry

### 3. Hook: useConfigureInstance
**Arquivo**: `src/pages/agente/meus-agentes/hooks/useConfigureInstance.ts`

Hook com mutation que:
- Chama a Edge Function `uazapi-admin`
- Invalida cache do status de conexão após sucesso
- Retorna estados de loading, erro e sucesso

### 4. Atualizar config.toml
**Arquivo**: `supabase/config.toml`

Adicionar configuração para a nova Edge Function:
```toml
[functions.uazapi-admin]
verify_jwt = false
```

---

## Arquivos a Modificar

### 1. ConnectionControlButtons.tsx
Modificar o handler do botão "Configurar Instância":
- Trocar o `toast.info()` por abrir o `ConfigureInstanceDialog`
- Passar o agente como prop para o dialog

### 2. externalDb.ts
Adicionar método para atualizar credenciais de conexão do agente:
```typescript
async updateAgentConnection(
  agentId: number, 
  connectionData: {
    hub: string;
    evo_url: string;
    evo_apikey: string;
    evo_instancia: string;
  }
): Promise<void>
```

### 3. db-query Edge Function
Adicionar nova action `update_agent_connection`:
```sql
UPDATE agents 
SET hub = $1, evo_url = $2, evo_apikey = $3, evo_instancia = $4, updated_at = now()
WHERE id = $5
```

### 4. types.ts (meus-agentes)
Adicionar interface para a resposta de criação de instância:
```typescript
export interface CreateInstanceResponse {
  success: boolean;
  instanceName: string;
  token: string;
  error?: string;
}
```

---

## Fluxo Detalhado: Configurar Instância

```text
1. Usuário clica "Configurar Instância"
   └─▶ Abre ConfigureInstanceDialog

2. Dialog exibe formulário
   ├─ Nome da instância: "[20250901] - Nome do Cliente" (editável)
   └─ Botão "Configurar"

3. Usuário clica "Configurar"
   └─▶ mutation.mutate()

4. useConfigureInstance chama Edge Function uazapi-admin
   ├─ action: 'create_instance'
   ├─ agentId: agent.agent_id_from_agents
   ├─ instanceName: "[20250901] - Nome do Cliente"
   └─ codAgent: agent.cod_agent

5. Edge Function uazapi-admin:
   │
   ├─▶ Etapa 1: Criar Instância na UaZapi
   │   POST https://atende-julia.uazapi.com/admin/instance
   │   Headers: { admintoken: UAZAPI_ADMIN_TOKEN }
   │   Body: { name: "[20250901] - Nome do Cliente" }
   │   Response: { id: "...", name: "...", token: "abc123..." }
   │
   ├─▶ Etapa 2: Configurar Webhook
   │   POST https://atende-julia.uazapi.com/webhook/set
   │   Headers: { token: "abc123..." }
   │   Body: {
   │     url: "https://webhook-url/messages",
   │     events: ["messages.upsert"],
   │     ignore_groups: true
   │   }
   │
   └─▶ Etapa 3: Salvar no Banco de Dados
       UPDATE agents SET
         hub = 'uazapi',
         evo_url = 'https://atende-julia.uazapi.com',
         evo_apikey = 'abc123...',
         evo_instancia = '[20250901] - Nome do Cliente'
       WHERE id = agentId

6. Sucesso: Dialog fecha e status atualiza para 'disconnected'
   └─▶ Usuário pode agora clicar "Conectar" para escanear QR Code

7. Erro: Dialog mostra mensagem de erro
   └─▶ Usuário pode tentar novamente
```

---

## Estrutura Final de Arquivos

```text
src/pages/agente/meus-agentes/
├── MyAgentsPage.tsx
├── types.ts                              (modificar)
├── components/
│   ├── AgentCard.tsx
│   ├── ConnectionStatusBadge.tsx
│   ├── ConnectionControlButtons.tsx      (modificar)
│   ├── ConfigureInstanceDialog.tsx       (criar)
│   └── QRCodeDialog.tsx
└── hooks/
    ├── useMyAgents.ts
    ├── useConnectionStatus.ts
    ├── useConnectionActions.ts
    ├── useConfigureInstance.ts           (criar)
    └── useQRCodePolling.ts

supabase/functions/
├── db-query/
│   └── index.ts                          (modificar)
└── uazapi-admin/
    └── index.ts                          (criar)

src/lib/
└── externalDb.ts                         (modificar)
```

---

## Secrets Necessários

| Secret | Descrição | Ação |
|--------|-----------|------|
| `UAZAPI_ADMIN_TOKEN` | Token admin do servidor UaZapi | Solicitar ao usuário |
| `UAZAPI_BASE_URL` | URL base (ex: `https://atende-julia.uazapi.com`) | Solicitar ao usuário |
| `UAZAPI_WEBHOOK_URL` | URL para receber webhooks de mensagens | Solicitar ao usuário |

---

## Resumo das Alterações

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/functions/uazapi-admin/index.ts` | Criar | Edge Function para operações admin UaZapi |
| `supabase/config.toml` | Modificar | Adicionar config da nova function |
| `supabase/functions/db-query/index.ts` | Modificar | Adicionar action `update_agent_connection` |
| `src/lib/externalDb.ts` | Modificar | Adicionar método `updateAgentConnection` |
| `src/pages/agente/meus-agentes/types.ts` | Modificar | Adicionar interfaces |
| `src/pages/agente/meus-agentes/hooks/useConfigureInstance.ts` | Criar | Hook para criar instância |
| `src/pages/agente/meus-agentes/components/ConfigureInstanceDialog.tsx` | Criar | Dialog de configuração |
| `src/pages/agente/meus-agentes/components/ConnectionControlButtons.tsx` | Modificar | Integrar dialog |

---

## Pré-requisitos para Implementação

Antes de implementar, você precisará fornecer:

1. **UAZAPI_ADMIN_TOKEN**: Token administrativo do seu servidor UaZapi
2. **UAZAPI_BASE_URL**: URL do seu servidor (ex: `https://atende-julia.uazapi.com`)
3. **UAZAPI_WEBHOOK_URL**: URL onde seu sistema recebe webhooks de mensagens do WhatsApp

Posso solicitar esses secrets assim que o plano for aprovado.
