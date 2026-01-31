

# Plano: Correcao dos Problemas da Sala de Espera e Gravacao

## Problemas Identificados

### 1. Posicao na fila nao aparece
**Causa raiz:** O hook `useLeadQueuePosition` chama a action `queue-status` que retorna 0 quando o lead ainda nao foi registrado como aguardando. O problema esta em:
- A action `lead-waiting` precisa retornar a posicao apos registrar o lead
- O `useLeadQueuePosition` nao recebe resposta inicial correta do `lead-waiting`

### 2. Sala nao iniciou quando atendente entrou
**Causa raiz:** Olhando o banco, o `operator_joined_at` nunca e preenchido porque:
- O operador chama `operator-join` apenas depois de sair do lobby (no `handleConfirmJoin`)
- O Realtime subscription do lead esta escutando a tabela, mas o `old.operator_joined_at` nao vem preenchido no payload do Supabase por padrao

**Problema critico no Realtime:** O Supabase Realtime nao envia `old` por padrao - precisa de `REPLICA IDENTITY FULL` na tabela para que o `old` tenha todos os campos.

### 3. Gravacao nao disponivel
**Causa raiz:** Vejo no banco que `recording_status` = `none` mesmo para chamadas completadas. Isso acontece porque:
- A gravacao so inicia no evento `joined-meeting` do **CustomVideoCall** (operador)
- Quando o operador chama `close`, o `record_id` nao e capturado corretamente
- A API do Daily retorna status 404 quando a gravacao ainda esta processando

---

## Correcoes Necessarias

### Correcao 1: Habilitar REPLICA IDENTITY FULL para Realtime funcionar

O Supabase Realtime precisa que a tabela tenha `REPLICA IDENTITY FULL` para enviar os valores antigos (old) no payload de UPDATE.

```sql
ALTER TABLE video_call_records REPLICA IDENTITY FULL;
```

### Correcao 2: Corrigir hook useLeadQueuePosition para usar resposta do lead-waiting

O hook `useLeadQueuePosition` deve usar a resposta do `lead-waiting` que ja retorna a posicao, em vez de chamar `queue-status` separadamente.

**Mudancas em `useRealtimeQueue.ts`:**
- Remover chamada separada a `queue-status`
- Usar a resposta do `lead-waiting` do `LeadWaitingRoom`

**Mudancas em `LeadWaitingRoom.tsx`:**
- Passar a posicao retornada pelo `lead-waiting` para o estado
- Atualizar posicao quando receber eventos Realtime da tabela

### Correcao 3: Corrigir deteccao de operator_joined no Realtime

**Mudancas em `useRealtimeQueue.ts`:**
O payload do Realtime nao tem `old` populado sem REPLICA IDENTITY. Apos habilitar, a logica vai funcionar. Mas como backup, podemos verificar apenas se `new.operator_joined_at` existe:

```typescript
if (newRecord.operator_joined_at) {
  onOperatorJoinedRef.current?.();
}
```

Isso pode causar chamadas duplicadas, entao precisamos de um estado para rastrear se ja processamos.

### Correcao 4: Melhorar fluxo de gravacao

O problema e que quando a sala fecha, nem sempre ha uma gravacao ativa. Precisamos:

1. Verificar se ha uma sessao de gravacao ANTES de tentar parar
2. Buscar gravacoes existentes para a sala apos fechar

**Mudancas em `video-room/index.ts` (action `close`):**
- Antes de chamar `/recordings/stop`, verificar se existe gravacao com `/recordings?room_name=X`
- Se encontrar gravacao em andamento, parar e salvar o ID
- Se encontrar gravacao ja concluida, salvar diretamente

### Correcao 5: Adicionar estado para evitar processamento duplicado de Realtime

**Mudancas em `LeadWaitingRoom.tsx`:**
- Adicionar ref `hasTransitioned` para evitar que o callback `onOperatorJoined` seja chamado multiplas vezes

---

## Arquivos a Modificar

| Arquivo | Modificacao |
|---------|-------------|
| **Migracao SQL** | Adicionar `REPLICA IDENTITY FULL` |
| `src/pages/video/hooks/useRealtimeQueue.ts` | Corrigir logica de deteccao de operador, adicionar guards |
| `src/pages/video/components/LeadWaitingRoom.tsx` | Usar posicao retornada do lead-waiting, adicionar guards |
| `supabase/functions/video-room/index.ts` | Corrigir action `close` para buscar gravacoes existentes |

---

## Detalhes das Correcoes

### 1. Migracao SQL

```sql
-- Habilitar REPLICA IDENTITY FULL para Realtime enviar dados antigos
ALTER TABLE video_call_records REPLICA IDENTITY FULL;
```

### 2. useRealtimeQueue.ts - Corrigir deteccao

```typescript
// Adicionar estado para rastrear se ja processou
const hasNotifiedOperatorRef = useRef(false);

// Na subscription do room
if (newRecord.operator_joined_at && !hasNotifiedOperatorRef.current) {
  hasNotifiedOperatorRef.current = true;
  onOperatorJoinedRef.current?.();
}
```

### 3. LeadWaitingRoom.tsx - Gerenciar estado corretamente

```typescript
const [position, setPosition] = useState(0);
const [totalInQueue, setTotalInQueue] = useState(0);
const hasTransitioned = useRef(false);

// Ao registrar lead-waiting, usar a resposta
const { data } = await supabase.functions.invoke('video-room', {
  body: { action: 'lead-waiting', roomName },
});
if (data?.success) {
  setPosition(data.position);
  setTotalInQueue(data.totalInQueue);
}

// No callback de operator joined
const handleOperatorJoined = useCallback(() => {
  if (hasTransitioned.current) return;
  hasTransitioned.current = true;
  onOperatorJoined();
}, [onOperatorJoined]);
```

### 4. video-room/index.ts - Corrigir busca de gravacao

```typescript
case 'close': {
  const { roomName } = body as CloseRoomRequest;
  
  let recordingId: string | null = null;
  
  // 1. Tentar parar gravacao ativa
  try {
    const stopResponse = await fetch(
      `${DAILY_API_URL}/rooms/${roomName}/recordings/stop`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${DAILY_API_KEY}` },
      }
    );
    
    if (stopResponse.ok) {
      const stopData = await stopResponse.json();
      recordingId = stopData.id || null;
    }
  } catch (e) {
    console.log('No active recording to stop');
  }
  
  // 2. Se nao conseguiu parar, buscar gravacoes existentes
  if (!recordingId) {
    try {
      const listResponse = await fetch(
        `${DAILY_API_URL}/recordings?room_name=${roomName}`,
        {
          headers: { 'Authorization': `Bearer ${DAILY_API_KEY}` },
        }
      );
      
      if (listResponse.ok) {
        const listData = await listResponse.json();
        // Pegar a gravacao mais recente
        if (listData.data?.length > 0) {
          recordingId = listData.data[0].id;
        }
      }
    } catch (e) {
      console.error('Failed to list recordings:', e);
    }
  }
  
  // ... resto da logica
}
```

---

## Resumo das Correcoes

1. **REPLICA IDENTITY FULL** - Essencial para Realtime funcionar com `old` values
2. **Guards contra duplicacao** - Evita multiplas transicoes/notificacoes
3. **Posicao na fila** - Usar resposta do `lead-waiting` diretamente
4. **Busca de gravacao** - Listar gravacoes existentes se parada falhar
5. **Limpeza de stream** - Garantir que camera/microfone sao liberados na transicao

