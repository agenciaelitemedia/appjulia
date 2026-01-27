

## Exibir Status de Conexão WhatsApp nos Cards de Agentes

### Objetivo
Adicionar ao card de agente na página "Meus Agentes" informações sobre o status da conexão WhatsApp, usando dados da tabela `agents` e verificando o status em tempo real via API UaZapi.

---

## Arquitetura da solução

### Fluxo de dados
1. Buscar dados de conexão do banco (`hub`, `evo_url`, `evo_apikey`, `evo_instancia`)
2. Para cada agente com tipo `hub = 'uazapi'`, verificar status via API
3. Exibir badge com cor correspondente:
   - **Amarelo**: Sem dados de conexão configurados
   - **Verde**: Conectado (WhatsApp ativo)
   - **Vermelho**: Desconectado (instância offline)

---

## Mudanças a implementar

### 1. Edge Function - Adicionar campos de conexão na query

**Arquivo:** `supabase/functions/db-query/index.ts`

**Ação `get_user_agents` (linhas 366-392):**

Adicionar os campos de conexão do agente:

```sql
SELECT 
  ua.agent_id,
  ua.cod_agent::text as cod_agent,
  a.id as agent_id_from_agents,
  a.status,
  -- Campos de conexão (novos)
  a.hub,
  a.evo_url,
  a.evo_apikey,
  a.evo_instancia,
  -- Campos existentes
  c.name as client_name,
  c.business_name,
  ap.name as plan_name,
  ap."limit" as plan_limit,
  (subquery leads_received...)
FROM user_agents ua
...
```

---

### 2. Atualizar tipos TypeScript

**Arquivo:** `src/pages/agente/meus-agentes/types.ts`

Adicionar campos de conexão à interface:

```typescript
export interface UserAgent {
  agent_id: number | null;
  cod_agent: string;
  agent_id_from_agents: number | null;
  status: boolean;
  client_name: string | null;
  business_name: string | null;
  plan_name: string | null;
  plan_limit: number | null;
  leads_received: number;
  // Campos de conexão
  hub: string | null;
  evo_url: string | null;
  evo_apikey: string | null;
  evo_instancia: string | null;
}
```

---

### 3. Hook para verificar status de conexão

**Novo arquivo:** `src/pages/agente/meus-agentes/hooks/useConnectionStatus.ts`

Hook que verifica o status de conexão de um agente específico:

```typescript
import { useQuery } from '@tanstack/react-query';
import { UaZapiClient } from '@/lib/uazapi/client';

export type ConnectionStatus = 'no_config' | 'connected' | 'disconnected' | 'checking';

export function useConnectionStatus(
  hub: string | null,
  evoUrl: string | null,
  evoApikey: string | null,
  evoInstancia: string | null
) {
  return useQuery({
    queryKey: ['connection-status', evoUrl, evoInstancia],
    queryFn: async (): Promise<ConnectionStatus> => {
      // Sem configuração
      if (!hub || !evoUrl || !evoApikey) {
        return 'no_config';
      }
      
      // Apenas suporta uazapi por enquanto
      if (hub !== 'uazapi') {
        return 'no_config';
      }
      
      try {
        const client = new UaZapiClient({
          baseUrl: evoUrl,
          token: evoApikey,
          instance: evoInstancia || undefined,
        });
        
        const response = await client.get<{ status: string }>('/instance/status');
        return response.status === 'connected' ? 'connected' : 'disconnected';
      } catch {
        return 'disconnected';
      }
    },
    enabled: !!hub && hub === 'uazapi' && !!evoUrl && !!evoApikey,
    staleTime: 60000, // Cache por 1 minuto
    retry: 1,
  });
}
```

---

### 4. Componente de Badge de Status

**Novo arquivo:** `src/pages/agente/meus-agentes/components/ConnectionStatusBadge.tsx`

Componente visual para exibir o status:

```typescript
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, AlertCircle, Loader2 } from 'lucide-react';
import { ConnectionStatus } from '../hooks/useConnectionStatus';

interface ConnectionStatusBadgeProps {
  status: ConnectionStatus;
  isLoading?: boolean;
}

export function ConnectionStatusBadge({ status, isLoading }: ConnectionStatusBadgeProps) {
  if (isLoading) {
    return (
      <Badge variant="outline" className="gap-1">
        <Loader2 className="w-3 h-3 animate-spin" />
        Verificando...
      </Badge>
    );
  }

  switch (status) {
    case 'connected':
      return (
        <Badge className="bg-green-500 hover:bg-green-600 gap-1">
          <Wifi className="w-3 h-3" />
          Conectado
        </Badge>
      );
    case 'disconnected':
      return (
        <Badge variant="destructive" className="gap-1">
          <WifiOff className="w-3 h-3" />
          Desconectado
        </Badge>
      );
    case 'no_config':
    default:
      return (
        <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black gap-1">
          <AlertCircle className="w-3 h-3" />
          Sem conexão
        </Badge>
      );
  }
}
```

---

### 5. Atualizar AgentCard

**Arquivo:** `src/pages/agente/meus-agentes/components/AgentCard.tsx`

Integrar o badge de status de conexão ao card:

```typescript
import { useConnectionStatus } from '../hooks/useConnectionStatus';
import { ConnectionStatusBadge } from './ConnectionStatusBadge';

export function AgentCard({ agent, isMonitored = false }: AgentCardProps) {
  const { data: connectionStatus = 'no_config', isLoading } = useConnectionStatus(
    agent.hub,
    agent.evo_url,
    agent.evo_apikey,
    agent.evo_instancia
  );

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        {/* Header com badges */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              {isMonitored ? (
                <Eye className="w-4 h-4 text-muted-foreground" />
              ) : (
                <Bot className="w-4 h-4 text-primary" />
              )}
              <Badge variant={agent.status ? "default" : "secondary"}>
                {agent.status ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
            {/* Badge de conexão WhatsApp */}
            <ConnectionStatusBadge status={connectionStatus} isLoading={isLoading} />
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            #{agent.cod_agent}
          </span>
        </div>

        {/* Nome e detalhes */}
        <h3 className="font-semibold text-foreground mb-1 truncate">
          {agent.business_name || agent.client_name || 'Sem nome'}
        </h3>

        {/* Instância WhatsApp (se configurada) */}
        {agent.evo_instancia && (
          <p className="text-xs text-muted-foreground mb-2 truncate">
            Instância: {agent.evo_instancia}
          </p>
        )}

        {/* Resto do card... */}
      </CardContent>
    </Card>
  );
}
```

---

## Design UX/UI

### Layout visual do card atualizado

```text
+-----------------------------------------------+
| [🤖] Ativo                   cod: 20250901    |
| [🟢] Conectado                                |
|                                               |
|   Escritório XYZ                              |
|   Instância: minha-instancia                  |
|   Plano: Premium                              |
|                                               |
|   Leads: 45/100 este mês                      |
|   ████████░░░░░░░░░░░  45%                    |
+-----------------------------------------------+
```

### Estados do badge de conexão

| Estado | Cor | Ícone | Texto |
|--------|-----|-------|-------|
| Sem configuração | Amarelo | AlertCircle | "Sem conexão" |
| Conectado | Verde | Wifi | "Conectado" |
| Desconectado | Vermelho | WifiOff | "Desconectado" |
| Verificando | Cinza | Loader2 (animado) | "Verificando..." |

### Comportamento

- O status é verificado automaticamente ao carregar a página
- Cache de 1 minuto para evitar requisições excessivas
- Se a verificação falhar (erro de rede, API offline), assume "Desconectado"
- Verificação só ocorre para agentes com `hub = 'uazapi'`

---

## Resumo das alterações por arquivo

| Arquivo | Ação |
|---------|------|
| `supabase/functions/db-query/index.ts` | Adicionar `hub`, `evo_url`, `evo_apikey`, `evo_instancia` na query |
| `src/pages/agente/meus-agentes/types.ts` | Adicionar campos de conexão à interface |
| `src/pages/agente/meus-agentes/hooks/useConnectionStatus.ts` | Novo hook para verificar status |
| `src/pages/agente/meus-agentes/components/ConnectionStatusBadge.tsx` | Novo componente de badge |
| `src/pages/agente/meus-agentes/components/AgentCard.tsx` | Integrar badge e exibir instância |

---

## Considerações técnicas

### Segurança
- A `evo_apikey` é sensível e não deve ser exibida na interface
- Usada apenas no hook para verificar status, nunca renderizada

### Performance
- Verificações em paralelo para todos os agentes
- Cache de 1 minuto evita sobrecarga na API
- Retry limitado a 1 tentativa para não bloquear a UI

### Extensibilidade
- Estrutura preparada para suportar outros tipos de `hub` no futuro (evolution, etc.)
- Basta adicionar a lógica de verificação específica no hook

