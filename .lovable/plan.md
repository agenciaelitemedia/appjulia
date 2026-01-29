
# Plano de Correção: Problemas de Entrada nas Salas de Vídeo

## Análise dos Problemas Encontrados

Baseado nos logs de console e análise do código, identifiquei **5 problemas críticos**:

### Problema 1: Erro "Meeting is full" (CRÍTICO)
**Causa:** O log mostra `Meeting is full` - a sala está configurada para 2 participantes, mas algo está causando tentativas duplicadas de entrada ou a sala já está cheia.

**Log evidência:**
```
[CustomVideoCall] Daily error: {"errorMsg": "Meeting is full", "error": {"type": "meeting-full"}}
```

**Causa raiz:** O operador pode estar tentando entrar em uma sala onde já existem 2 conexões (possivelmente de tentativas anteriores que não foram limpas corretamente).

### Problema 2: Múltiplas Instâncias do Call Object
**Causa:** O `useEffect` cria um novo `call object` mas o cleanup pode não estar sendo executado corretamente quando o componente é remontado rapidamente (React StrictMode faz double-render em dev).

**Localização:** `CustomVideoCall.tsx` e `LeadVideoCall.tsx`

### Problema 3: Cleanup Incompleto ao Sair
**Causa:** O `call.leave()` e `call.destroy()` são chamados no cleanup, mas se o usuário sair rapidamente, pode haver race conditions.

### Problema 4: State `setCallObject` Antes do Join
**Causa:** No código atual, `setCallObject(call)` é chamado ANTES de `await call.join()`. Isso pode causar o componente renderizar o `DailyProvider` antes da conexão estar estabelecida.

```typescript
// Problema no código atual (linha 115-119):
if (mounted) {
  setCallObject(call);  // ❌ Seta estado ANTES do join
}
await call.join({ url: roomUrl });  // Join acontece depois
```

### Problema 5: Falta de Tratamento para Desconexão Forçada
**Causa:** Não há tratamento para o caso em que a sala expirou ou foi deletada enquanto o usuário estava tentando entrar.

## Plano de Correção

### Correção 1: Reordenar Lógica de Inicialização
Mudar a ordem: primeiro fazer o `join`, depois setar o `callObject` no state.

```typescript
// ANTES (problemático):
setCallObject(call);
await call.join({ url: roomUrl });

// DEPOIS (correto):
await call.join({ url: roomUrl });
setCallObject(call);  // Só seta após conectar
```

### Correção 2: Adicionar Mutex para Prevenir Conexões Duplicadas
Usar uma ref para garantir que apenas uma tentativa de conexão aconteça por vez.

```typescript
const isConnecting = useRef(false);

const initCall = async () => {
  if (isConnecting.current) return;  // Previne duplicatas
  isConnecting.current = true;
  // ... resto do código
};
```

### Correção 3: Melhorar Cleanup com Await Correto
```typescript
return () => {
  mounted = false;
  isConnecting.current = false;
  if (call) {
    // Destruir imediatamente, sem await no cleanup
    try {
      call.destroy();
    } catch (e) {
      console.warn('Error destroying call:', e);
    }
  }
};
```

### Correção 4: Tratamento Específico para "Meeting is Full"
Adicionar tratamento específico para o erro `meeting-full`:

```typescript
call.on('error', (event) => {
  if (event?.error?.type === 'meeting-full') {
    onError?.('Sala lotada. Aguarde a saída do participante ou crie uma nova sala.');
  } else {
    onError?.(event?.errorMsg || 'Erro na conexão');
  }
});
```

### Correção 5: Aumentar Limite de Participantes (Opcional)
Na Edge Function, aumentar `max_participants` de 2 para 3 ou 4 como margem de segurança:

```typescript
// supabase/functions/video-room/index.ts
properties: {
  max_participants: 4,  // Era 2, aumentar para margem
  // ...
}
```

### Correção 6: Adicionar Botão de Reconexão
Na tela de erro, adicionar opção de tentar novamente:

```tsx
if (hasError) {
  return (
    <div className="...">
      <p>Erro ao conectar</p>
      <Button onClick={() => {
        setHasError(false);
        setIsLoading(true);
        // Reiniciar conexão
      }}>
        Tentar novamente
      </Button>
    </div>
  );
}
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/video/components/CustomVideoCall.tsx` | Reordenar lógica, adicionar mutex, melhorar cleanup |
| `src/pages/video/components/LeadVideoCall.tsx` | Mesmas correções do CustomVideoCall |
| `supabase/functions/video-room/index.ts` | Aumentar max_participants |

## Detalhes Técnicos da Implementação

### CustomVideoCall.tsx - Versão Corrigida

```typescript
export function CustomVideoCall({ roomUrl, onLeave, onError }: CustomVideoCallProps) {
  const [callObject, setCallObject] = useState<DailyCall | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const isConnecting = useRef(false);
  const callRef = useRef<DailyCall | null>(null);

  useEffect(() => {
    let mounted = true;

    const initCall = async () => {
      // Prevenir conexões duplicadas
      if (isConnecting.current || callRef.current) {
        console.log('[CustomVideoCall] Already connecting or connected, skipping');
        return;
      }
      
      isConnecting.current = true;

      try {
        console.log('[CustomVideoCall] Creating call object...');
        const call = DailyIframe.createCallObject({
          subscribeToTracksAutomatically: true,
        });
        
        callRef.current = call;

        // Handler de erro com mensagens específicas
        call.on('error', (event) => {
          console.error('[CustomVideoCall] Daily error:', event);
          if (!mounted) return;
          
          let message = 'Erro na conexão';
          if (event?.error?.type === 'meeting-full') {
            message = 'Sala lotada. Aguarde ou crie uma nova sala.';
          } else if (event?.error?.type === 'exp-room') {
            message = 'Sala expirada. Crie uma nova sala.';
          }
          
          setErrorMessage(message);
          setHasError(true);
          onError?.(message);
        });

        console.log('[CustomVideoCall] Joining room:', roomUrl);
        
        // IMPORTANTE: Join ANTES de setar o state
        await call.join({ url: roomUrl });
        
        console.log('[CustomVideoCall] Successfully joined room');
        
        if (mounted) {
          setCallObject(call);
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error('[CustomVideoCall] Error joining call:', err);
        if (mounted) {
          const message = err?.errorMsg || 'Erro ao entrar na chamada';
          setErrorMessage(message);
          setHasError(true);
          onError?.(message);
        }
      } finally {
        isConnecting.current = false;
      }
    };

    initCall();

    return () => {
      mounted = false;
      isConnecting.current = false;
      
      const call = callRef.current;
      if (call) {
        console.log('[CustomVideoCall] Cleaning up call object');
        callRef.current = null;
        // Destruir síncronamente
        try {
          call.destroy();
        } catch (e) {
          console.warn('[CustomVideoCall] Error destroying:', e);
        }
      }
    };
  }, [roomUrl]);

  const handleRetry = () => {
    setHasError(false);
    setErrorMessage('');
    setIsLoading(true);
    // O useEffect vai disparar novamente
  };

  if (hasError) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-background rounded-lg">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <p className="text-destructive text-lg">Erro ao conectar</p>
          <p className="text-muted-foreground text-sm max-w-xs">{errorMessage}</p>
          <Button onClick={handleRetry} variant="outline">
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  // ... resto do componente
}
```

### Edge Function - max_participants

```typescript
// supabase/functions/video-room/index.ts - linha 101
properties: {
  exp: Math.floor(Date.now() / 1000) + 3600,
  enable_chat: true,
  enable_screenshare: true,
  enable_knocking: false,
  start_video_off: false,
  start_audio_off: false,
  max_participants: 4,  // ALTERADO: era 2, agora 4
  lang: 'pt',
  enable_prejoin_ui: false,
  enable_network_ui: true,
},
```

## Ordem de Execução

1. **Corrigir CustomVideoCall.tsx** - Reordenar lógica de conexão, adicionar mutex e retry
2. **Corrigir LeadVideoCall.tsx** - Mesmas correções
3. **Atualizar Edge Function** - Aumentar max_participants
4. **Deploy da Edge Function** - Aplicar mudanças
5. **Testar fluxo completo** - Lead entra, operador entra, chamada funciona

## Verificações Pós-Implementação

1. Criar nova sala pelo CRM
2. Copiar link e abrir em aba anônima (simula lead)
3. Verificar se lead entra corretamente
4. Clicar em "Atender" no painel do operador
5. Verificar se operador entra e vê o lead
6. Verificar se ambos têm áudio e vídeo funcionando
7. Encerrar chamada e verificar se histórico é registrado
