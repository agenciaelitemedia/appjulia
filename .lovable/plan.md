
# Plano: Corrigir Sincronizacao entre Operador e Lead

## Problemas Identificados

### 1. Race Condition no Fluxo do Operador

O fluxo atual tem uma corrida critica:

```
Fluxo atual (QUEBRADO):
1. Operador clica "Entrar na Chamada"
2. handleConfirmJoin() chama operatorJoin.mutate() (ASYNC)
3. onSuccess/onError -> setCallState('call') (imediato)
4. CustomVideoCall monta, faz join no Daily
5. joined-meeting -> record-start -> status = 'active'
6. Lead some da fila (status != 'pending')
7. MAS operator_joined_at pode nao ter sido atualizado ainda!
8. Lead nunca recebe notificacao Realtime
```

O problema e que `setCallState('call')` acontece ANTES de garantir que `operator-join` completou.

### 2. Status 'active' Remove Lead da Fila Prematuramente

A query `list` filtra `status = 'pending'`:

```typescript
let query = supabase
  .from('video_call_records')
  .select('*')
  .eq('status', 'pending')  // <-- Lead some quando status muda
  .not('lead_waiting_at', 'is', null)
  .is('operator_joined_at', null);
```

Quando `record-start` muda para `active`, o lead desaparece da fila do operador antes de transicionar para a chamada.

### 3. operator_joined_at Nunca e Preenchido

Dados do banco mostram TODOS os registros com `operator_joined_at = NULL`:

```
julia-20251101-1769879842698: operator_joined_at = NULL
julia-20251101-1769877211395: operator_joined_at = NULL  
julia-20251101-1769874955347: operator_joined_at = NULL
```

Isso indica que `operator-join` nunca esta sendo chamado corretamente ou esta falhando.

---

## Solucao Proposta

### Correcao 1: Aguardar operator-join antes de iniciar chamada

Modificar `VideoQueuePage.tsx` para so transicionar para `call` APOS o `operator-join` completar com sucesso.

```typescript
const handleConfirmJoin = useCallback(async () => {
  if (!selectedRoom) return;
  
  try {
    // AWAIT the mutation to complete before transitioning
    await operatorJoin.mutateAsync({
      roomName: selectedRoom.name,
      operatorId: user?.id,
      operatorName: user?.name,
    });
    
    // Only transition after success
    setCallState('call');
  } catch (error) {
    console.error('Failed to notify operator join:', error);
    toast.error('Erro ao entrar na sala. Tente novamente.');
    // Do NOT transition if failed
    setCallState('idle');
    setSelectedRoom(null);
  }
}, [selectedRoom, operatorJoin, user]);
```

### Correcao 2: Remover status 'active' do filtro da fila

A query `list` nao deveria depender do status para filtrar leads aguardando. O criterio correto e:

- `lead_waiting_at` preenchido (lead entrou na sala de espera)
- `operator_joined_at` NULL (operador ainda nao entrou)
- `ended_at` NULL (chamada nao encerrada)

Modificar a edge function para usar este criterio:

```typescript
case 'list': {
  let query = supabase
    .from('video_call_records')
    .select('*')
    .not('lead_waiting_at', 'is', null)
    .is('operator_joined_at', null)
    .is('ended_at', null);  // Nao usar status

  // ... resto
}
```

### Correcao 3: Adicionar log na action operator-join

Adicionar logs detalhados para debug e verificar se a action esta sendo chamada.

### Correcao 4: Mover preenchimento de operator_id/operator_name para operator-join

Atualmente, `record-start` tambem preenche `operator_id` e `operator_name`. Isso causa duplicacao e pode sobrescrever valores. Centralizar no `operator-join`.

---

## Arquivos a Modificar

| Arquivo | Modificacao |
|---------|-------------|
| `src/pages/video/VideoQueuePage.tsx` | Aguardar `mutateAsync` completar antes de transicionar |
| `supabase/functions/video-room/index.ts` | Corrigir query `list` para nao depender de status |
| `supabase/functions/video-room/index.ts` | Adicionar logs no `operator-join` |

---

## Detalhes das Correcoes

### 1. VideoQueuePage.tsx - Aguardar mutation

```typescript
const handleConfirmJoin = useCallback(async () => {
  if (!selectedRoom) return;
  
  try {
    // Mostrar estado de loading
    toast.loading('Entrando na sala...', { id: 'join-room' });
    
    // AWAIT mutation to complete
    await operatorJoin.mutateAsync({
      roomName: selectedRoom.name,
      operatorId: user?.id,
      operatorName: user?.name,
    });
    
    toast.success('Conectado!', { id: 'join-room' });
    setCallState('call');
  } catch (error) {
    console.error('Failed to notify operator join:', error);
    toast.error('Erro ao entrar na sala', { id: 'join-room' });
    setCallState('idle');
    setSelectedRoom(null);
  }
}, [selectedRoom, operatorJoin, user]);
```

### 2. Edge Function - Corrigir query list

```typescript
case 'list': {
  const { codAgents } = body as ListRoomsRequest;
  
  // Get rooms where lead is waiting but operator hasn't joined yet
  let query = supabase
    .from('video_call_records')
    .select('*')
    .not('lead_waiting_at', 'is', null)  // Lead esta esperando
    .is('operator_joined_at', null)       // Operador nao entrou
    .is('ended_at', null);                // Chamada nao encerrada
  
  // Remover: .eq('status', 'pending')
  
  if (codAgents && codAgents.length > 0) {
    query = query.in('cod_agent', codAgents);
  }
  
  const { data: dbRooms, error: dbError } = await query.order('lead_waiting_at', { ascending: true });
  // ...
}
```

### 3. Edge Function - Melhorar logs no operator-join

```typescript
case 'operator-join': {
  const { roomName, operatorId, operatorName } = body as OperatorJoinRequest;
  
  console.log('[operator-join] Request:', { roomName, operatorId, operatorName });
  
  const { error: updateError, data: updateData } = await supabase
    .from('video_call_records')
    .update({ 
      operator_joined_at: new Date().toISOString(),
      operator_id: operatorId,
      operator_name: operatorName,
    })
    .eq('room_name', roomName)
    .select();
  
  if (updateError) {
    console.error('[operator-join] Update failed:', updateError);
    throw new Error('Failed to register operator join');
  }
  
  console.log('[operator-join] Success:', updateData);
  
  return new Response(
    JSON.stringify({ success: true, updated: updateData }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

---

## Resumo

1. **Aguardar operator-join completar**: Usar `mutateAsync` e so transicionar apos sucesso
2. **Corrigir query da fila**: Remover dependencia de `status`, usar `ended_at` como criterio
3. **Melhorar logs**: Adicionar logs detalhados para debug
4. **Ordem de operacoes garantida**: operator-join -> transicionar -> joined-meeting -> record-start
