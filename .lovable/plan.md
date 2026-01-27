
## Plano de Implementação: Botões de Controle de Conexão WhatsApp

### Objetivo
Adicionar botões de controle de conexão dinâmicos nos cards de agente na página "Meus Agentes", permitindo:
- **Sem conexão**: Criar instância e configurar webhook
- **Desconectado**: Conectar via QR Code
- **Conectado**: Desconectar

---

## Análise da Estrutura Atual

### Resposta da API `/instance/status`
```json
{
  "instance": {
    "id": "r4f4efd7dab8735",
    "status": "connected",
    "qrcode": "",           // QR Code base64 quando desconectado
    "name": "[20260101] - Dra. Cristiane",
    "profileName": "Dra Cristiane Oliveira",
    "profilePicUrl": "https://...",
    ...
  },
  "status": {
    "connected": true,
    "loggedIn": true,
    "jid": "5521974348872:6@s.whatsapp.net"
  }
}
```

### Endpoints UaZapi Disponíveis
| Endpoint | Uso |
|----------|-----|
| `GET /instance/status` | Verifica status + QR Code |
| `GET /instance/qrcode` | Obtém QR Code para conexão |
| `POST /instance/connect` | Inicia conexão |
| `POST /instance/disconnect` | Desconecta instância |
| `POST /instance/logout` | Logout completo |

---

## Arquivos a Criar/Modificar

### 1. Novo Componente: Dialog de QR Code
**Arquivo:** `src/pages/agente/meus-agentes/components/QRCodeDialog.tsx`

Popup modal que:
- Exibe QR Code em base64 como imagem
- Atualiza automaticamente a cada 10 segundos
- Fecha automaticamente quando conectado
- Mostra loading durante carregamento
- Exibe mensagem de sucesso ao conectar

```text
┌──────────────────────────────────────────────┐
│  Conectar WhatsApp              [X]          │
├──────────────────────────────────────────────┤
│                                              │
│    ┌────────────────────────┐                │
│    │                        │                │
│    │      [QR CODE]         │                │
│    │                        │                │
│    └────────────────────────┘                │
│                                              │
│    Escaneie com o WhatsApp                   │
│    Atualização em 8s                         │
│                                              │
│    [Cancelar]                                │
└──────────────────────────────────────────────┘
```

### 2. Hook para Gerenciar QR Code
**Arquivo:** `src/pages/agente/meus-agentes/hooks/useQRCodePolling.ts`

Hook que:
- Busca QR Code via `/instance/status`
- Polling a cada 10 segundos
- Detecta quando `status.connected === true`
- Para o polling e retorna sucesso

```typescript
interface UseQRCodePollingResult {
  qrCode: string | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  countdown: number;
}
```

### 3. Hook para Ações de Conexão
**Arquivo:** `src/pages/agente/meus-agentes/hooks/useConnectionActions.ts`

Hook com mutations para:
- `disconnect()` - Desconecta a instância
- `connect()` - Inicia conexão (para obter QR Code)

### 4. Novo Componente: Botões de Controle
**Arquivo:** `src/pages/agente/meus-agentes/components/ConnectionControlButtons.tsx`

Renderiza botões baseado no status:

```text
Estado: no_config
┌─────────────────────────────────────┐
│  [⚙️ Configurar Instância]          │
└─────────────────────────────────────┘

Estado: disconnected
┌─────────────────────────────────────┐
│  [🔗 Conectar]                      │
└─────────────────────────────────────┘

Estado: connected
┌─────────────────────────────────────┐
│  [🔌 Desconectar]                   │
└─────────────────────────────────────┘
```

### 5. Atualizar AgentCard
**Arquivo:** `src/pages/agente/meus-agentes/components/AgentCard.tsx`

Integrar os novos botões de controle no card:

```text
┌──────────────────────────────────────────────┐
│ [🤖] [Ativo]            [🟢 Conectado]       │
├──────────────────────────────────────────────┤
│ Lira & Resende Advogados                     │
│ #20250702                                    │
│ Instância: [20250702] - João Victor          │
│ Plano: Básico                                │
│                                              │
│ Leads do mês       ██████████░░░░ 50/100     │
├──────────────────────────────────────────────┤
│            [🔌 Desconectar]                  │
└──────────────────────────────────────────────┘
```

---

## Detalhamento Técnico

### 1. QRCodeDialog.tsx

```typescript
interface QRCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: UserAgent;
  onConnected: () => void;
}

// Estrutura do componente:
// - Dialog com DialogContent
// - Imagem do QR Code (base64)
// - Countdown visual para próxima atualização
// - useEffect com setInterval para polling
// - Detecção de conexão para fechar automaticamente
```

### 2. useQRCodePolling.ts

```typescript
export function useQRCodePolling(
  evoUrl: string,
  evoApikey: string,
  enabled: boolean
) {
  return useQuery({
    queryKey: ['qr-code', evoUrl],
    queryFn: async () => {
      const client = new UaZapiClient({
        baseUrl: evoUrl,
        token: evoApikey,
      });
      
      const response = await client.get('/instance/status');
      
      return {
        qrCode: response.instance?.qrcode || null,
        isConnected: response.status?.connected === true && 
                     response.status?.loggedIn === true,
        profileName: response.instance?.profileName,
      };
    },
    enabled,
    refetchInterval: 10000, // 10 segundos
    staleTime: 0,
  });
}
```

### 3. useConnectionActions.ts

```typescript
export function useConnectionActions(agent: UserAgent) {
  const queryClient = useQueryClient();
  
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const client = new UaZapiClient({
        baseUrl: agent.evo_url!,
        token: agent.evo_apikey!,
      });
      return client.post('/instance/disconnect');
    },
    onSuccess: () => {
      // Invalidar cache do status
      queryClient.invalidateQueries({
        queryKey: ['connection-status', agent.evo_url],
      });
      toast.success('WhatsApp desconectado com sucesso');
    },
  });

  return {
    disconnect: disconnectMutation.mutate,
    isDisconnecting: disconnectMutation.isPending,
  };
}
```

### 4. ConnectionControlButtons.tsx

```typescript
interface ConnectionControlButtonsProps {
  agent: UserAgent;
  status: ConnectionStatus;
  isLoading: boolean;
}

export function ConnectionControlButtons({ 
  agent, 
  status, 
  isLoading 
}: ConnectionControlButtonsProps) {
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const { disconnect, isDisconnecting } = useConnectionActions(agent);
  
  // Renderiza botão apropriado baseado no status
  switch (status) {
    case 'no_config':
      return (
        <Button 
          variant="outline" 
          size="sm"
          onClick={handleConfigureInstance}
        >
          <Settings className="w-4 h-4 mr-2" />
          Configurar
        </Button>
      );
      
    case 'disconnected':
      return (
        <>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setQrDialogOpen(true)}
          >
            <QrCode className="w-4 h-4 mr-2" />
            Conectar
          </Button>
          <QRCodeDialog
            open={qrDialogOpen}
            onOpenChange={setQrDialogOpen}
            agent={agent}
            onConnected={handleConnected}
          />
        </>
      );
      
    case 'connected':
      return (
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => disconnect()}
          disabled={isDisconnecting}
        >
          {isDisconnecting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Unplug className="w-4 h-4 mr-2" />
          )}
          Desconectar
        </Button>
      );
  }
}
```

### 5. Atualização no AgentCard.tsx

Adicionar os botões de controle ao final do card:

```typescript
// Adicionar import
import { ConnectionControlButtons } from './ConnectionControlButtons';

// Dentro do CardContent, após a seção de leads:
{!isMonitored && (
  <div className="pt-3 mt-3 border-t border-border/50">
    <ConnectionControlButtons
      agent={agent}
      status={connectionStatus}
      isLoading={isLoading}
    />
  </div>
)}
```

**Nota**: Os botões só aparecem para "Meus Agentes", não para "Agentes Monitorados" (view-only).

---

## Fluxo de Cada Ação

### Fluxo: Conectar (status = disconnected)

```text
1. Usuário clica "Conectar"
2. Abre QRCodeDialog
3. Hook useQRCodePolling começa polling
4. Busca /instance/status a cada 10s
5. Exibe QR Code (instance.qrcode)
6. Usuário escaneia com WhatsApp
7. Próximo poll detecta status.connected = true
8. Dialog fecha automaticamente
9. Toast de sucesso
10. Atualiza status no card (cache invalidado)
```

### Fluxo: Desconectar (status = connected)

```text
1. Usuário clica "Desconectar"
2. Mutation chama POST /instance/disconnect
3. Mostra loading no botão
4. Sucesso: toast + invalida cache
5. Status atualiza para "disconnected"
```

### Fluxo: Configurar (status = no_config)

```text
1. Usuário clica "Configurar"
2. Exibe toast informativo (funcionalidade futura)
   "Entre em contato com o suporte para configurar sua instância"
```

**Nota**: A criação de instâncias na UaZapi requer acesso administrativo e configuração de webhooks. Para esta fase, o botão "Configurar" apenas exibirá uma mensagem orientando o usuário.

---

## Estrutura Final de Arquivos

```text
src/pages/agente/meus-agentes/
├── MyAgentsPage.tsx
├── types.ts
├── components/
│   ├── AgentCard.tsx           (modificar)
│   ├── ConnectionStatusBadge.tsx
│   ├── ConnectionControlButtons.tsx  (criar)
│   └── QRCodeDialog.tsx        (criar)
└── hooks/
    ├── useMyAgents.ts
    ├── useConnectionStatus.ts
    ├── useConnectionActions.ts  (criar)
    └── useQRCodePolling.ts     (criar)
```

---

## Resumo das Alterações

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `QRCodeDialog.tsx` | Criar | Dialog com QR Code e polling automático |
| `useQRCodePolling.ts` | Criar | Hook para polling do QR Code a cada 10s |
| `useConnectionActions.ts` | Criar | Hook com mutations (disconnect) |
| `ConnectionControlButtons.tsx` | Criar | Botões dinâmicos por status |
| `AgentCard.tsx` | Modificar | Integrar botões de controle |
| `types.ts` | Modificar | Adicionar tipos para QR Code response |

---

## Comportamentos Especiais

### QR Code Dialog
- **Auto-refresh**: Atualiza a cada 10 segundos
- **Countdown visual**: Mostra contador regressivo para próxima atualização
- **Auto-close**: Fecha quando detecta conexão bem-sucedida
- **Loading state**: Skeleton enquanto carrega QR Code
- **Error handling**: Mensagem se falhar ao obter QR Code

### Botões de Controle
- **Loading states**: Spinner durante ações
- **Toast feedback**: Mensagens de sucesso/erro
- **Cache invalidation**: Atualiza status automaticamente
- **Apenas para "Meus Agentes"**: Não aparece em "Agentes Monitorados"

---

## Dependências Utilizadas
- `@radix-ui/react-dialog` (já instalado)
- `@tanstack/react-query` (já instalado)
- `lucide-react` (já instalado)
- `sonner` (já instalado para toasts)
