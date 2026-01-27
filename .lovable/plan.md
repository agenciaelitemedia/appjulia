
## Correção do Status de Conexão WhatsApp

### Problema Identificado

Analisando as respostas da API UaZapi, identifiquei a estrutura correta:

```json
{
  "instance": {
    "id": "r402ab4f375e52d",
    "status": "connected",    // String - pode não refletir estado real
    "name": "[20250702] - João Victor e Felipe",
    "profileName": "Lira e Resende Advogados",
    ...
  },
  "status": {
    "connected": true,        // BOOLEANO - estado real da conexão
    "jid": "556692073586:48@s.whatsapp.net",
    "loggedIn": true          // BOOLEANO - se está logado
  }
}
```

**Erro atual**: O código verifica `response.status` que retorna o objeto `{ connected: true, ... }`, e depois compara com a string `'connected'`. Como objeto !== string, sempre cai na verificação errada.

A verificação correta deve usar:
- `response.status.connected` (booleano real)
- `response.status.loggedIn` (se está autenticado)

---

## Mudanças a Implementar

### 1. Corrigir o hook useConnectionStatus

**Arquivo:** `src/pages/agente/meus-agentes/hooks/useConnectionStatus.ts`

**Mudança na interface de resposta:**

```typescript
interface InstanceStatusResponse {
  instance?: {
    status?: string;
    name?: string;
    profileName?: string;
  };
  status?: {
    connected?: boolean;
    loggedIn?: boolean;
    jid?: string;
  };
}
```

**Mudança na lógica de verificação:**

```typescript
const response = await client.get<InstanceStatusResponse>('/instance/status');

// Verificar o campo correto: status.connected (booleano)
const isConnected = response.status?.connected === true && response.status?.loggedIn === true;

if (isConnected) {
  return 'connected';
}

return 'disconnected';
```

---

## Código Completo Atualizado

```typescript
import { useQuery } from '@tanstack/react-query';
import { UaZapiClient } from '@/lib/uazapi/client';
import { ConnectionStatus } from '../types';

interface InstanceStatusResponse {
  instance?: {
    status?: string;
    name?: string;
    profileName?: string;
  };
  status?: {
    connected?: boolean;
    loggedIn?: boolean;
    jid?: string;
  };
}

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
        
        const response = await client.get<InstanceStatusResponse>('/instance/status');
        
        // Verificar status.connected e status.loggedIn (booleanos reais)
        const isConnected = response.status?.connected === true && response.status?.loggedIn === true;
        
        if (isConnected) {
          return 'connected';
        }
        
        return 'disconnected';
      } catch {
        return 'disconnected';
      }
    },
    enabled: !!hub && hub === 'uazapi' && !!evoUrl && !!evoApikey,
    staleTime: 60000, // Cache por 1 minuto
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
```

---

## Resumo da Correção

| Item | Antes (incorreto) | Depois (correto) |
|------|------------------|------------------|
| Campo verificado | `response.status` (objeto) | `response.status.connected` (booleano) |
| Comparação | `=== 'connected'` (string) | `=== true` (booleano) |
| Validação extra | Nenhuma | `status.loggedIn === true` |

---

## Estrutura de Resposta da API

Para referência futura, a API `/instance/status` da UaZapi retorna:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `instance.status` | string | Status geral da instância (sempre "connected" se existe) |
| `instance.name` | string | Nome da instância |
| `instance.profileName` | string | Nome do perfil WhatsApp |
| `status.connected` | boolean | **Se está conectado ao WhatsApp** |
| `status.loggedIn` | boolean | **Se está autenticado** |
| `status.jid` | string | ID do WhatsApp conectado |

A combinação `status.connected === true && status.loggedIn === true` indica conexão ativa real.
