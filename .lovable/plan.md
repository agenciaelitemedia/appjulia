

# Plano de Correção: Links de Gravação Ausentes nas Reuniões

## Diagnóstico Detalhado

### Evidências Encontradas

**1. Dados do Banco de Dados:**
| Sala | Operador | recording_id | recording_status | Duração |
|------|----------|--------------|------------------|---------|
| julia-20250702-1769717438947 | Mario Castro | **NULL** | **none** | 283s |
| julia-20250702-1769715727195 | Mario Castro | **NULL** | **none** | 309s |

Ambas as reuniões completadas têm `recording_id = NULL` e `recording_status = 'none'`, indicando que a gravação **nunca foi iniciada**.

**2. Teste Direto da API:**
```json
{
  "message": "Call started (recording unavailable)",
  "recordingStarted": false,
  "success": true
}
```

**3. Log de Erro Encontrado:**
```
Recording start warning (non-blocking): {"error":"not-found","info":"room julia-20250702-1769717438947 not found"}
```

---

## Causa Raiz Identificada

### Problema Principal: Timing da Gravação

O fluxo atual está incorreto:

```text
FLUXO ATUAL (PROBLEMÁTICO):
1. Operador clica "Atender"
2. Frontend chama record-start IMEDIATAMENTE
3. record-start tenta iniciar gravação
4. Mas o operador ainda NÃO entrou na sala!
5. Daily.co retorna "room not found" (sala vazia = não existe meeting)
6. Gravação falha silenciosamente
7. Operador entra na sala (tarde demais)
```

### Por Que a Sala "Não É Encontrada"?

O Daily.co só considera uma "meeting" (reunião) ativa quando **há pelo menos um participante conectado**. Quando o `record-start` é chamado:

- O operador ainda está no processo de `createCallObject()` e `join()`
- A sala existe, mas não há "meeting" ativa
- A API de `/recordings/start` retorna `not-found` porque requer participantes

### Diagrama do Problema

```text
Tempo →
│
├─ t0: Operador clica "Atender"
├─ t1: Frontend chama record-start ← ❌ MUITO CEDO!
├─ t2: Edge Function tenta /recordings/start
├─ t3: Daily.co: "room not found" (sem participantes)
├─ t4: Gravação falha (recording_status = 'none')
│
├─ t5: createCallObject() inicia
├─ t6: join() executado
├─ t7: Operador conectado (meeting existe agora)
│
└─ Resultado: Chamada SEM gravação
```

---

## Solução Proposta

### Estratégia: Iniciar Gravação Após Conexão Confirmada

Mover a chamada de `record-start` para **depois** que o operador confirmar entrada na sala via evento `joined-meeting`.

```text
FLUXO CORRIGIDO:
1. Operador clica "Atender"
2. createCallObject() inicia
3. join() executado
4. Evento 'joined-meeting' dispara
5. AGORA chama record-start ← ✅ MOMENTO CORRETO
6. Daily.co inicia gravação (participante existe)
7. Gravação funciona!
```

---

## Implementação em 3 Etapas

### Etapa 1: Modificar VideoQueuePage.tsx

Remover a chamada `record-start` do `handleJoinRoom`:

```typescript
const handleJoinRoom = useCallback(async (room: VideoRoom) => {
  // REMOVIDO: Não chamar record-start aqui
  // A gravação será iniciada pelo CustomVideoCall após joined-meeting
  setActiveRoom(room);
}, []);
```

Passar informações necessárias para o componente de vídeo:

```typescript
<ActiveCallSection
  room={activeRoom}
  operatorId={user?.id}
  operatorName={user?.name}
  onLeave={handleLeaveRoom}
  onError={handleVideoError}
/>
```

### Etapa 2: Modificar CustomVideoCall.tsx

Adicionar callback para iniciar gravação após conexão:

```typescript
interface CustomVideoCallProps {
  roomUrl: string;
  roomName?: string;  // NOVO
  operatorId?: number;  // NOVO
  operatorName?: string;  // NOVO
  onLeave: () => void;
  onError?: (error: string) => void;
}

// No VideoCallContent, adicionar listener para joined-meeting:
useDailyEvent('joined-meeting', useCallback(async () => {
  console.log('[CustomVideoCall] joined-meeting - starting recording');
  
  // Iniciar gravação APÓS confirmar entrada
  if (roomName && operatorId) {
    try {
      const result = await supabase.functions.invoke('video-room', {
        body: {
          action: 'record-start',
          roomName,
          operatorId,
          operatorName,
        },
      });
      console.log('[CustomVideoCall] record-start result:', result.data);
    } catch (err) {
      console.error('[CustomVideoCall] record-start error:', err);
    }
  }
}, [roomName, operatorId, operatorName]));
```

### Etapa 3: Adicionar Indicador Visual de Gravação

Mostrar ao operador que a gravação está ativa:

```typescript
const [recordingStatus, setRecordingStatus] = useState<'none' | 'starting' | 'recording'>('none');

// Após record-start bem-sucedido:
if (result.data?.recordingStarted) {
  setRecordingStatus('recording');
}

// No JSX:
{recordingStatus === 'recording' && (
  <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-red-500 rounded-full text-white text-sm animate-pulse">
    <span className="w-2 h-2 bg-white rounded-full" />
    Gravando
  </div>
)}
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/video/VideoQueuePage.tsx` | Remover record-start do handleJoinRoom, passar props extras |
| `src/pages/video/components/CustomVideoCall.tsx` | Adicionar record-start no joined-meeting, indicador visual |

---

## Fluxo Corrigido Completo

```text
┌─────────────────────────────────────────────────────────────────────┐
│ 1. Operador clica em "Atender"                                      │
│    → setActiveRoom(room)                                            │
│    → CustomVideoCall monta                                          │
├─────────────────────────────────────────────────────────────────────┤
│ 2. CustomVideoCall cria callObject                                  │
│    → createCallObject()                                             │
│    → daily.join(url)                                                │
├─────────────────────────────────────────────────────────────────────┤
│ 3. Evento 'joined-meeting' dispara                                  │
│    → Operador está CONECTADO                                        │
│    → Meeting ativa no Daily.co                                      │
├─────────────────────────────────────────────────────────────────────┤
│ 4. Callback chama record-start                                      │
│    → POST /rooms/:name/recordings/start                             │
│    → Daily.co encontra a meeting ativa                              │
│    → Gravação inicia com sucesso!                                   │
│    → recording_status: 'recording'                                  │
├─────────────────────────────────────────────────────────────────────┤
│ 5. UI atualiza com indicador "Gravando"                             │
│    → Badge vermelho pulsante                                        │
├─────────────────────────────────────────────────────────────────────┤
│ 6. Operador encerra chamada                                         │
│    → closeRoom.mutate()                                             │
│    → POST /rooms/:name/recordings/stop                              │
│    → recording_id capturado                                         │
│    → recording_status: 'processing'                                 │
├─────────────────────────────────────────────────────────────────────┤
│ 7. Daily.co processa gravação (1-5 min)                             │
│    → Arquivo MP4 disponível                                         │
├─────────────────────────────────────────────────────────────────────┤
│ 8. Histórico mostra botão de download                               │
│    → action: 'get-recording-link'                                   │
│    → Link temporário (1h) gerado                                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Verificações Pós-Implementação

1. Criar uma sala de reunião
2. Lead entra via link
3. Operador clica "Atender"
4. Verificar no console: `[CustomVideoCall] joined-meeting - starting recording`
5. Verificar resposta: `recordingStarted: true`
6. Verificar badge "Gravando" aparece
7. Encerrar chamada
8. Verificar no histórico que `recording_id` não é NULL
9. Clicar no botão de download após 2-5 minutos

---

## Resumo da Correção

```text
PROBLEMA:
- record-start chamado ANTES do operador entrar na sala
- Daily.co não encontra meeting ativa (sem participantes)
- Gravação falha silenciosamente

SOLUÇÃO:
- Mover record-start para listener 'joined-meeting'
- Garantir que a gravação só inicia APÓS conexão confirmada
- Adicionar indicador visual de gravação ativa
```

