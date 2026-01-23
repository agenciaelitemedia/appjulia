
# Plano: Criar Provider UaZapi para Integracao com WhatsApp

## Objetivo

Criar um provider centralizado com todos os endpoints da API UaZapi para facilitar o uso em qualquer parte do sistema, utilizando os dados de conexao (evo_url, evo_instance, evo_apikey) da tabela de usuarios/agentes.

---

## Arquitetura Proposta

```text
src/
  contexts/
    AuthContext.tsx (existente - contem credenciais)
    UaZapiContext.tsx (novo - provider principal)
  lib/
    uazapi/
      client.ts (cliente HTTP base)
      types.ts (tipos TypeScript)
      endpoints/
        agent.ts (configuracao do agente IA)
        business.ts (catalogo e perfil comercial)
        chat.ts (gerenciamento de chats)
        message.ts (envio de mensagens)
        group.ts (grupos e comunidades)
        instance.ts (status e conexao)
        labels.ts (etiquetas)
        chatwoot.ts (integracao Chatwoot)
```

---

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `src/lib/uazapi/types.ts` | Interfaces TypeScript para requests e responses |
| `src/lib/uazapi/client.ts` | Cliente HTTP base com autenticacao |
| `src/lib/uazapi/endpoints/agent.ts` | Endpoints de configuracao do agente IA |
| `src/lib/uazapi/endpoints/business.ts` | Endpoints de catalogo e perfil comercial |
| `src/lib/uazapi/endpoints/chat.ts` | Endpoints de gerenciamento de chats |
| `src/lib/uazapi/endpoints/message.ts` | Endpoints de envio de mensagens |
| `src/lib/uazapi/endpoints/group.ts` | Endpoints de grupos e comunidades |
| `src/lib/uazapi/endpoints/instance.ts` | Endpoints de status e conexao |
| `src/lib/uazapi/endpoints/labels.ts` | Endpoints de etiquetas |
| `src/lib/uazapi/endpoints/chatwoot.ts` | Endpoints de integracao Chatwoot |
| `src/lib/uazapi/index.ts` | Exportacao centralizada |
| `src/contexts/UaZapiContext.tsx` | Context/Provider React |
| `src/hooks/useUaZapi.ts` | Hook para consumir o provider |

---

## Endpoints Mapeados do Documento

### Agente IA
- `POST /agent/edit` - Criar/Editar agente
- `GET /agent/list` - Listar agentes

### Business / Catalogo
- `POST /business/catalog/delete` - Deletar produto
- `POST /business/catalog/hide` - Ocultar produto
- `POST /business/catalog/info` - Info do produto
- `POST /business/catalog/list` - Listar produtos
- `POST /business/catalog/show` - Mostrar produto
- `GET /business/get/categories` - Categorias de negocios
- `POST /business/get/profile` - Obter perfil comercial
- `POST /business/update/profile` - Atualizar perfil

### Chamadas
- `POST /call/make` - Iniciar chamada
- `POST /call/reject` - Rejeitar chamada

### Chats
- `POST /chat/archive` - Arquivar/desarquivar
- `POST /chat/block` - Bloquear/desbloquear
- `GET /chat/blocklist` - Lista de bloqueados
- `POST /chat/check` - Verificar numeros no WhatsApp
- `POST /chat/delete` - Deletar chat
- `POST /chat/details` - Detalhes do chat
- `POST /chat/editLead` - Editar informacoes de lead
- `POST /chat/find` - Buscar chats com filtros
- `POST /chat/labels` - Gerenciar labels
- `POST /chat/mute` - Silenciar chat
- `POST /chat/pin` - Fixar/desafixar
- `POST /chat/read` - Marcar como lido

### Grupos e Comunidades
- `POST /community/create` - Criar comunidade
- `POST /community/editgroups` - Gerenciar grupos

### Integracao Chatwoot
- `GET /chatwoot/config` - Obter config
- `PUT /chatwoot/config` - Atualizar config

---

## Detalhamento Tecnico

### 1. Cliente HTTP Base (client.ts)

```typescript
interface UaZapiConfig {
  baseUrl: string;  // evo_url do usuario
  token: string;    // evo_apikey do usuario
  instance?: string; // evo_instance do usuario
}

class UaZapiClient {
  private config: UaZapiConfig;
  
  constructor(config: UaZapiConfig) {
    this.config = config;
  }
  
  async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    body?: Record<string, any>
  ): Promise<T> {
    const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'token': this.config.token,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'UaZapi API Error');
    }
    
    return response.json();
  }
}
```

### 2. Context Provider (UaZapiContext.tsx)

```typescript
interface UaZapiContextType {
  isConfigured: boolean;
  client: UaZapiClient | null;
  // Endpoints agrupados
  agent: AgentEndpoints;
  business: BusinessEndpoints;
  chat: ChatEndpoints;
  message: MessageEndpoints;
  group: GroupEndpoints;
  instance: InstanceEndpoints;
  labels: LabelsEndpoints;
  chatwoot: ChatwootEndpoints;
}

// O provider usa os dados do AuthContext
function UaZapiProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  
  const client = useMemo(() => {
    if (!user?.evo_url || !user?.evo_apikey) return null;
    return new UaZapiClient({
      baseUrl: user.evo_url,
      token: user.evo_apikey,
      instance: user.evo_instance,
    });
  }, [user?.evo_url, user?.evo_apikey, user?.evo_instance]);
  
  // Inicializa endpoints com o client
  const value = useMemo(() => ({
    isConfigured: !!client,
    client,
    agent: createAgentEndpoints(client),
    business: createBusinessEndpoints(client),
    chat: createChatEndpoints(client),
    // ... outros endpoints
  }), [client]);
  
  return (
    <UaZapiContext.Provider value={value}>
      {children}
    </UaZapiContext.Provider>
  );
}
```

### 3. Exemplo de Uso no Componente

```typescript
function AgentConfig() {
  const { agent, isConfigured } = useUaZapi();
  
  const handleSave = async () => {
    if (!isConfigured) {
      toast.error('API nao configurada');
      return;
    }
    
    await agent.edit({
      name: 'Julia',
      provider: 'openai',
      model: 'gpt-4o',
      basePrompt: 'Voce e uma assistente...',
    });
  };
}
```

### 4. Tipos TypeScript (types.ts)

Todos os requests e responses serao tipados baseados no documento OpenAPI:

```typescript
// Agente
interface AgentConfig {
  name: string;
  provider: 'openai' | 'anthropic' | 'gemini' | 'deepseek';
  apikey: string;
  model: string;
  basePrompt: string;
  temperature?: number;
  maxTokens?: number;
  // ... outros campos
}

// Chat
interface ChatDetails {
  id: string;
  wa_name?: string;
  wa_archived?: boolean;
  lead_name?: string;
  lead_status?: string;
  // ... outros campos
}

// Verificacao de numeros
interface CheckNumberResult {
  query: string;
  jid: string;
  isInWhatsapp: boolean;
  verifiedName?: string;
}
```

---

## Fluxo de Dados

```text
Usuario logado (AuthContext)
    |
    v
Credenciais UaZapi (evo_url, evo_apikey, evo_instance)
    |
    v
UaZapiProvider inicializa cliente
    |
    v
Componentes usam hook useUaZapi()
    |
    v
Chamadas diretas para API UaZapi
```

---

## Ordem de Implementacao

1. **types.ts** - Definir todas as interfaces
2. **client.ts** - Cliente HTTP base
3. **endpoints/*.ts** - Implementar cada grupo de endpoints
4. **index.ts** - Exportar tudo
5. **UaZapiContext.tsx** - Provider React
6. **useUaZapi.ts** - Hook de consumo
7. **Atualizar App.tsx** - Adicionar provider

---

## Beneficios

1. **Centralizacao**: Todos os endpoints em um unico lugar
2. **Tipagem**: TypeScript completo para autocomplete e seguranca
3. **Reutilizacao**: Qualquer componente pode usar via hook
4. **Configuracao automatica**: Usa credenciais do usuario logado
5. **Organizacao**: Endpoints agrupados por funcionalidade
6. **Manutencao**: Facil adicionar novos endpoints

---

## Resultado Esperado

Um sistema de integracao completo onde qualquer parte do aplicativo pode facilmente fazer chamadas para a API UaZapi apenas importando o hook `useUaZapi()`.
