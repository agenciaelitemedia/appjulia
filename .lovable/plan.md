

# Plano: Correcao do Preview da Camera e Inicio Automatico da Sala

## Problemas Identificados

### Problema 1: Preview da camera nao aparece na sala de espera

**Causa raiz:** O video element nao esta mostrando o stream corretamente. Analisando o `LeadWaitingRoom.tsx`:

```typescript
// Linha 98-100
if (videoRef.current) {
  videoRef.current.srcObject = stream;
}
```

O problema e que este codigo esta dentro do `initializeCamera` que roda quando o componente monta, mas a atribuicao do `srcObject` pode estar sendo feita antes do elemento `<video>` estar no DOM (devido ao `isInitializing` ainda ser `true`).

**Fluxo atual:**
1. `initializeCamera()` comeca a rodar
2. `isInitializing = true`, entao o video element NAO esta no DOM (mostra loader)
3. Stream e obtido
4. `videoRef.current.srcObject = stream` - MAS o video element ainda nao existe!
5. `setIsInitializing(false)` - agora o video element aparece, MAS sem o stream

### Problema 2: Sala nao inicia quando atendente entra

**Causa raiz verificada no banco de dados:**
```
room_name: julia-20251101-1769877211395
lead_waiting_at: 2026-01-31 16:33:55.432+00
operator_joined_at: NULL  <-- NUNCA FOI PREENCHIDO!
status: active
```

O `operator_joined_at` nunca esta sendo preenchido, o que significa que:
1. O operador clica em "Entrar na Chamada" no lobby
2. O `handleConfirmJoin` e chamado
3. O `operatorJoin.mutate()` e executado
4. O backend atualiza `operator_joined_at`
5. O Realtime deveria notificar o lead

Mas olhando os logs de rede, nao ha nenhuma chamada `operator-join` recente. Isso indica que o fluxo esta quebrando em algum ponto.

**Investigacao adicional:** O `PreJoinLobby` cria sua propria instancia do Daily (`lobbyCallInstance`) e a destroi quando o operador clica "Entrar". Depois, o `CustomVideoCall` cria uma nova instancia. Essa transicao pode estar causando problemas de estado.

**Problema critico encontrado:** O `handleConfirmJoin` no `VideoQueuePage` chama `operatorJoin.mutate()` ANTES de transicionar para `call`. Se a mutacao falhar ou demorar, ainda transiciona (linhas 120-128), mas a notificacao nao chega ao lead.

Adicionalmente, o subscription Realtime no `useRealtimeQueue` pode nao estar funcionando corretamente porque:
1. A condicao `!oldRecord.operator_joined_at` depende de `REPLICA IDENTITY FULL` (que ja foi aplicado)
2. MAS se a subscription nao estiver ativa ou houver erro, o callback nunca e chamado

---

## Correcoes Necessarias

### Correcao 1: Atribuir stream ao video APOS o elemento existir no DOM

Modificar `LeadWaitingRoom.tsx` para usar um `useEffect` separado que atribui o stream ao video element depois que `isInitializing` se torna `false`.

```typescript
// Novo useEffect para atribuir stream ao video quando o elemento existir
useEffect(() => {
  if (!isInitializing && videoRef.current && streamRef.current) {
    videoRef.current.srcObject = streamRef.current;
  }
}, [isInitializing]);
```

### Correcao 2: Garantir que o callback Realtime seja chamado corretamente

O problema pode estar na logica de verificacao. Atualmente:

```typescript
if (newRecord.operator_joined_at && !oldRecord.operator_joined_at && !hasNotifiedOperatorRef.current) {
```

Se por algum motivo o `oldRecord` estiver vazio (mesmo com REPLICA IDENTITY FULL, a subscription pode ter sido criada apos o registro existir), a verificacao `!oldRecord.operator_joined_at` pode falhar.

**Correcao:** Simplificar a logica para verificar apenas se `newRecord.operator_joined_at` existe e o guard nao foi acionado:

```typescript
if (newRecord.operator_joined_at && !hasNotifiedOperatorRef.current) {
  hasNotifiedOperatorRef.current = true;
  onOperatorJoinedRef.current?.();
}
```

### Correcao 3: Adicionar polling como fallback para Realtime

Mesmo com Realtime, problemas de conectividade podem impedir que eventos cheguem. Adicionar um polling de fallback a cada 5 segundos para verificar se o operador ja entrou.

### Correcao 4: Logging de debug para identificar problemas

Adicionar logs detalhados no hook Realtime para identificar se a subscription esta funcionando e quais eventos estao sendo recebidos.

---

## Arquivos a Modificar

| Arquivo | Modificacao |
|---------|-------------|
| `src/pages/video/components/LeadWaitingRoom.tsx` | Corrigir atribuicao do stream ao video element |
| `src/pages/video/hooks/useRealtimeQueue.ts` | Simplificar logica de deteccao + adicionar logs + polling fallback |

---

## Detalhes das Correcoes

### 1. LeadWaitingRoom.tsx - Corrigir preview da camera

```typescript
// Adicionar useEffect para atribuir stream DEPOIS que o video element existe
useEffect(() => {
  // Quando isInitializing muda para false e temos stream, atribuir ao video
  if (!isInitializing && streamRef.current && videoRef.current) {
    videoRef.current.srcObject = streamRef.current;
    // Garantir que o video toca
    videoRef.current.play().catch(e => console.warn('Video autoplay blocked:', e));
  }
}, [isInitializing]);

// Modificar initializeCamera para NAO tentar atribuir ao video
useEffect(() => {
  const initializeCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      streamRef.current = stream;
      setIsInitializing(false);
      
      // REMOVIDO: a atribuicao ao videoRef sera feita no outro useEffect
    } catch (err) {
      // ... error handling
    }
  };

  initializeCamera();
  // ... cleanup
}, [onError]);
```

### 2. useRealtimeQueue.ts - Melhorar deteccao do operador

```typescript
export function useRealtimeQueue(options: UseRealtimeQueueOptions) {
  const { roomName, codAgents, onOperatorJoined, onQueueUpdate, onRecordingReady } = options;
  const channelsRef = useRef<RealtimeChannel[]>([]);
  const hasNotifiedOperatorRef = useRef(false);

  // ... refs ...

  useEffect(() => {
    // Cleanup e setup das subscriptions
    channelsRef.current.forEach(ch => supabase.removeChannel(ch));
    channelsRef.current = [];

    if (roomName) {
      console.log('[useRealtimeQueue] Setting up subscription for room:', roomName);
      
      const roomChannel = supabase
        .channel(`room-${roomName}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'video_call_records',
            filter: `room_name=eq.${roomName}`,
          },
          (payload) => {
            console.log('[useRealtimeQueue] Received UPDATE:', payload);
            const newRecord = payload.new as Record<string, unknown>;
            
            // Simplificar: apenas verificar se tem operator_joined_at
            if (newRecord.operator_joined_at && !hasNotifiedOperatorRef.current) {
              console.log('[useRealtimeQueue] Operator joined! Notifying...');
              hasNotifiedOperatorRef.current = true;
              onOperatorJoinedRef.current?.();
            }
            
            // ... resto da logica
          }
        )
        .subscribe((status) => {
          console.log('[useRealtimeQueue] Subscription status:', status);
        });

      channelsRef.current.push(roomChannel);
      
      // FALLBACK: Polling a cada 5s para verificar se operador entrou
      const pollInterval = setInterval(async () => {
        if (hasNotifiedOperatorRef.current) {
          clearInterval(pollInterval);
          return;
        }
        
        try {
          const { data } = await supabase.functions.invoke('video-room', {
            body: { action: 'join', roomName },
          });
          
          if (data?.room?.operatorJoined && !hasNotifiedOperatorRef.current) {
            console.log('[useRealtimeQueue] Fallback polling detected operator joined');
            hasNotifiedOperatorRef.current = true;
            onOperatorJoinedRef.current?.();
          }
        } catch (e) {
          console.warn('[useRealtimeQueue] Polling error:', e);
        }
      }, 5000);

      // Adicionar cleanup do polling
      return () => {
        clearInterval(pollInterval);
        channelsRef.current.forEach(ch => supabase.removeChannel(ch));
        channelsRef.current = [];
      };
    }
    
    // ... resto
  }, [roomName, codAgents?.join(',')]);
}
```

---

## Resumo das Correcoes

1. **Preview da camera**: Separar a logica de atribuicao do stream em um `useEffect` que roda apos `isInitializing` se tornar `false`

2. **Deteccao do operador**: 
   - Simplificar a condicao de verificacao (remover dependencia de `oldRecord`)
   - Adicionar logs detalhados para debug
   - Adicionar polling de fallback a cada 5 segundos

3. **Robustez**: Se o Realtime falhar por qualquer motivo, o polling garantira que o lead seja notificado

