

## Plano: Corrigir Geração do QR Code

### Problema Identificado
O QR Code não está sendo gerado porque a instância é criada no estado `disconnected` e **nunca é iniciada**. O endpoint `GET /instance/status` retorna `qrcode: ""` (vazio) porque a instância precisa ser conectada primeiro via `POST /instance/connect`.

**Evidência nos logs de rede:**
```json
{
  "instance": { "qrcode": "", "status": "disconnected" },
  "status": { "connected": false, "loggedIn": false }
}
```

### Solução

Chamar `POST /instance/connect` **antes** de abrir o dialog de QR Code, para que a instância inicie o processo de geração do QR.

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/agente/meus-agentes/components/ConnectionControlButtons.tsx` | Chamar `connect()` ao clicar em "Conectar", antes de abrir o dialog |
| `src/pages/agente/meus-agentes/hooks/useQRCodePolling.ts` | Adicionar chamada inicial de connect ao iniciar polling (fallback) |

### Mudanças Detalhadas

#### 1. ConnectionControlButtons.tsx

Modificar o handler do botão "Conectar" para chamar `connect()` antes de abrir o dialog:

```typescript
// Linha 23 - Adicionar connect ao destructuring
const { disconnect, isDisconnecting, connect, isConnecting } = useConnectionActions(agent);

// Linha 72-80 - Modificar o caso 'disconnected'
case 'disconnected':
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          connect();  // ← Chamar connect primeiro
          setQrDialogOpen(true);
        }}
        disabled={isConnecting}
        className="w-full"
      >
        {isConnecting ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <QrCode className="w-4 h-4 mr-2" />
        )}
        Conectar
      </Button>
      <QRCodeDialog ... />
    </>
  );
```

#### 2. useQRCodePolling.ts (Melhoria adicional)

Adicionar uma chamada `POST /instance/connect` no início do polling como garantia, caso a instância ainda não esteja gerando QR Code:

```typescript
// Dentro de queryFn, antes de buscar status
const response = await client.get<InstanceStatusResponse>('/instance/status');

// Se não tem QR Code e não está conectado, tentar iniciar conexão
if (!response.instance?.qrcode && !response.status?.connected) {
  try {
    await client.post('/instance/connect');
    // Buscar status novamente após connect
    const newResponse = await client.get<InstanceStatusResponse>('/instance/status');
    return {
      qrCode: newResponse.instance?.qrcode || null,
      isConnected: newResponse.status?.connected === true && newResponse.status?.loggedIn === true,
      profileName: newResponse.instance?.profileName || null,
    };
  } catch {
    // Ignorar erro - connect pode falhar se já estiver em progresso
  }
}
```

### Fluxo Corrigido

```text
1. Usuário clica "Conectar"
2. Frontend chama POST /instance/connect
3. Abre QRCodeDialog
4. useQRCodePolling faz GET /instance/status
5. API retorna { qrcode: "base64...", status: "connecting" }
6. Frontend exibe o QR Code
7. Usuário escaneia
8. Polling detecta connected: true
9. Dialog fecha automaticamente
```

### Resumo das Mudanças

| Item | Antes | Depois |
|------|-------|--------|
| Clique em "Conectar" | Apenas abre dialog | Chama connect() + abre dialog |
| Polling sem QR | Exibe "Aguardando..." | Tenta connect automaticamente |
| Estado do botão | Sempre habilitado | Desabilitado durante connecting |

