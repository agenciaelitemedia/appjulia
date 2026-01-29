
# Plano de Correcao: Desconexao do Operador na Sala de Reuniao

## Diagnostico Detalhado

Apos analise criteriosa do codigo e logs, identifico **multiplas causas potenciais** para a desconexao do operador apos poucos segundos:

### Problema 1: Erro na API de Gravacao do Daily.co (CRITICO)

**Log de erro encontrado:**
```
Failed to start recording: {"info":"\"max_duration\" is not allowed [Received max_duration=3600]","error":"invalid-request-error"}
```

**Causa raiz:** O parametro esta incorreto - a API do Daily.co espera `maxDuration` (camelCase), mas o codigo envia `max_duration` (snake_case).

**Impacto:** Quando a gravacao falha ao iniciar, o Daily.co pode estar rejeitando a sessao ou causando instabilidade na conexao.

**Localizacao:** `supabase/functions/video-room/index.ts`, linha 354

```typescript
// ERRADO (atual)
body: JSON.stringify({
  type: 'cloud',
  layout: { preset: 'default' },
  max_duration: 3600, // <- snake_case incorreto
}),

// CORRETO
body: JSON.stringify({
  type: 'cloud',
  layout: { preset: 'default' },
  maxDuration: 3600, // <- camelCase correto
}),
```

---

### Problema 2: Race Condition no Cleanup do Call Object

**Analise do codigo em `CustomVideoCall.tsx`:**

O cleanup no `useEffect` (linha 284-289) chama `destroyExistingInstance()` que executa `leave()` e `destroy()` na instancia global. Isso pode ocorrer prematuramente em certos cenarios:

1. Quando o `retryKey` muda (retry solicitado)
2. Quando o componente e desmontado (navegacao ou erro)
3. Quando o React faz fast-refresh durante desenvolvimento

**Fluxo problematico:**
```text
1. Operador clica "Atender"
2. CustomVideoCall monta
3. createCallObject() inicia
4. record-start e chamado (com erro de API)
5. Possivel re-render causa cleanup
6. destroyExistingInstance() e chamado
7. Operador e desconectado
```

---

### Problema 3: Listener de `left-meeting` Muito Agressivo

O codigo escuta o evento `left-meeting` e chama `onLeave()` imediatamente:

```typescript
useDailyEvent('left-meeting', useCallback(() => {
  console.log('[CustomVideoCall] Evento left-meeting recebido');
  onLeave(); // <- Isso pode ser disparado por qualquer desconexao
}, [onLeave]));
```

O problema e que `left-meeting` pode ser disparado por:
- Desconexao de rede temporaria
- Timeout de WebSocket
- Erro na API
- Fechamento intencional

**Diferenca entre Lead e Operador:**

| Fator | Lead (Cliente) | Operador |
|-------|---------------|----------|
| Componente | `LeadVideoCall` | `CustomVideoCall` |
| Contexto React | Simples (pagina isolada) | Complexo (dentro de MainLayout com providers) |
| Polling | Nenhum | `useVideoRooms` a cada 10s |
| Chamada record-start | Nao | Sim (com erro) |

O operador esta dentro de um contexto mais complexo com mais re-renders potenciais.

---

### Problema 4: Query Polling Pode Causar Re-renders

```typescript
const { data: rooms = [], isLoading, refetch, isFetching } = useVideoRooms();
// refetchInterval: 10000 <- A cada 10 segundos
```

Quando o polling ocorre, o estado `rooms` muda, causando re-render do `VideoQueuePage`. Embora o `activeRoom` nao dependa diretamente de `rooms`, qualquer instabilidade no React pode causar efeitos colaterais.

---

## Plano de Correcao em 6 Etapas

### Etapa 1: Corrigir API de Gravacao (Edge Function)

Corrigir o nome do parametro de `max_duration` para `maxDuration`:

```typescript
// supabase/functions/video-room/index.ts (case 'record-start')
body: JSON.stringify({
  type: 'cloud',
  layout: { preset: 'default' },
  maxDuration: 3600, // CORRIGIDO: camelCase
}),
```

### Etapa 2: Adicionar Tratamento de Erro Robusto na Gravacao

Nao permitir que falha de gravacao afete a conexao principal:

```typescript
case 'record-start': {
  const { roomName, operatorId, operatorName } = body as RecordStartRequest;
  
  // Gravacao e feature secundaria - nao deve bloquear a chamada
  let recordingStarted = false;
  try {
    const startRecordingResponse = await fetch(
      `${DAILY_API_URL}/rooms/${roomName}/recordings/start`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DAILY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'cloud',
          layout: { preset: 'default' },
          maxDuration: 3600,
        }),
      }
    );
    
    if (startRecordingResponse.ok) {
      recordingStarted = true;
      console.log('Recording started successfully');
    } else {
      const errorText = await startRecordingResponse.text();
      console.warn('Recording start warning (non-blocking):', errorText);
    }
  } catch (recordingError) {
    console.warn('Recording start error (non-blocking):', recordingError);
  }
  
  // Atualizar banco independente do status da gravacao
  await supabase
    .from('video_call_records')
    .update({ 
      started_at: new Date().toISOString(),
      operator_id: operatorId,
      operator_name: operatorName,
      recording_status: recordingStarted ? 'recording' : 'none',
      status: 'active' 
    })
    .eq('room_name', roomName);

  return new Response(
    JSON.stringify({ 
      success: true, 
      message: recordingStarted ? 'Recording started' : 'Call started (recording unavailable)',
      recordingStarted 
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

### Etapa 3: Proteger Call Object Contra Destruicao Prematura

Adicionar flag `isLeaving` para evitar race conditions:

```typescript
// CustomVideoCall.tsx
const [isLeaving, setIsLeaving] = useState(false);
const isLeavingRef = useRef(false);

// Modificar handlers
const handleError = useCallback((msg: string) => {
  if (isLeavingRef.current) return; // Ignorar erros durante saida
  console.error('[CustomVideoCall] handleError:', msg);
  setErrorMessage(msg);
  setHasError(true);
  onError?.(msg);
}, [onError]);

// Modificar evento left-meeting
useDailyEvent('left-meeting', useCallback(() => {
  if (isLeavingRef.current) return; // Ja estava saindo
  console.log('[CustomVideoCall] Evento left-meeting recebido');
  isLeavingRef.current = true;
  setIsLeaving(true);
  onLeave();
}, [onLeave]));

// Modificar cleanup
useEffect(() => {
  let mounted = true;

  const createCallObject = async () => {
    if (isLeavingRef.current) return; // Nao criar se estiver saindo
    
    await destroyExistingInstance();
    
    if (!mounted || isLeavingRef.current) return;
    // ... resto do codigo
  };

  createCallObject();

  return () => {
    mounted = false;
    // NAO destruir automaticamente - deixar o leave() cuidar disso
    // destroyExistingInstance() sera chamado apenas via handleLeave
  };
}, [retryKey, handleError]);
```

### Etapa 4: Isolar Chamada de Atualizar do VideoCall

Evitar que polling cause re-renders no componente de video:

```typescript
// VideoQueuePage.tsx
// Separar o componente de video em memo
const ActiveCallSection = memo(function ActiveCallSection({ 
  room, 
  onLeave, 
  onError 
}: { 
  room: VideoRoom;
  onLeave: () => void;
  onError: (error: string) => void;
}) {
  return (
    <Card className="h-full min-h-[400px] overflow-hidden">
      <CustomVideoCall
        roomUrl={room.url}
        onLeave={onLeave}
        onError={onError}
      />
    </Card>
  );
});

// Usar no JSX
{activeRoom && (
  <ActiveCallSection
    room={activeRoom}
    onLeave={handleLeaveRoom}
    onError={(error) => {
      console.error('Video call error:', error);
      setActiveRoom(null);
      toast.error('Erro ao conectar. Tente novamente.');
    }}
  />
)}
```

### Etapa 5: Implementar Logica de Reconexao Automatica

Adicionar suporte a reconexao em caso de desconexao temporaria:

```typescript
// CustomVideoCall.tsx - Adicionar monitoramento de rede
useDailyEvent('network-connection', useCallback((event) => {
  console.log('[CustomVideoCall] network-connection:', event);
  if (event?.type === 'connected') {
    setDebugState('Conectado');
  } else if (event?.type === 'disconnected') {
    setDebugState('Desconectado - tentando reconectar...');
  }
}, []));

useDailyEvent('nonfatal-error', useCallback((event) => {
  console.warn('[CustomVideoCall] nonfatal-error:', event);
  // Erros nao-fatais nao devem causar desconexao
}, []));
```

### Etapa 6: Adicionar Logging Detalhado para Debug

Implementar logging abrangente para diagnostico futuro:

```typescript
// CustomVideoCall.tsx - Adicionar listeners de diagnostico
useEffect(() => {
  if (!callObject) return;

  const logEvent = (name: string, event: any) => {
    console.log(`[CustomVideoCall] Event ${name}:`, event);
  };

  // Eventos criticos para monitorar
  callObject.on('joining-meeting', (e) => logEvent('joining-meeting', e));
  callObject.on('joined-meeting', (e) => logEvent('joined-meeting', e));
  callObject.on('left-meeting', (e) => logEvent('left-meeting', e));
  callObject.on('error', (e) => logEvent('error', e));
  callObject.on('participant-joined', (e) => logEvent('participant-joined', e));
  callObject.on('participant-left', (e) => logEvent('participant-left', e));
  callObject.on('network-connection', (e) => logEvent('network-connection', e));
  callObject.on('nonfatal-error', (e) => logEvent('nonfatal-error', e));
  callObject.on('call-instance-destroyed', (e) => logEvent('call-instance-destroyed', e));

  return () => {
    callObject.off('joining-meeting');
    callObject.off('joined-meeting');
    callObject.off('left-meeting');
    callObject.off('error');
    callObject.off('participant-joined');
    callObject.off('participant-left');
    callObject.off('network-connection');
    callObject.off('nonfatal-error');
    callObject.off('call-instance-destroyed');
  };
}, [callObject]);
```

---

## Arquivos a Modificar

| Arquivo | Mudancas |
|---------|----------|
| `supabase/functions/video-room/index.ts` | Corrigir `maxDuration`, melhorar tratamento de erro |
| `src/pages/video/components/CustomVideoCall.tsx` | Proteger contra race conditions, adicionar logging |
| `src/pages/video/VideoQueuePage.tsx` | Isolar componente de video com memo |

---

## Ordem de Implementacao

1. **Edge Function** - Corrigir erro de API (impacto imediato)
2. **CustomVideoCall** - Proteger contra race conditions
3. **VideoQueuePage** - Isolar re-renders
4. **Testes** - Validar fluxo completo

---

## Verificacoes Pos-Implementacao

1. Abrir sala de reuniao
2. Lead entra via link
3. Operador clica "Atender"
4. Confirmar que ambos permanecem conectados por mais de 1 minuto
5. Verificar logs no console para eventos `joined-meeting`
6. Confirmar que gravacao inicia sem erro

---

## Solucao Tecnica Resumida

```text
PROBLEMA RAIZ:
- API de gravacao com parametro incorreto causa falha silenciosa
- Race condition no cleanup do React causa left-meeting prematuro
- Re-renders do polling afetam o componente de video

CORRECAO:
- Corrigir maxDuration (camelCase)
- Tratar falha de gravacao como nao-bloqueante
- Usar refs para controlar fluxo de saida
- Memorizar componente de video
- Adicionar listeners de diagnostico
```
