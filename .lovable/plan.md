

# Plano: Sala de Recepcao com Fila em Tempo Real e Link de Gravacao no Historico

## Visao Geral

Este plano implementa uma sala de espera (recepcao) onde leads aguardam antes de serem conectados ao atendente, com **atualizacoes em tempo real** usando Supabase Realtime. O sistema inclui isolamento multi-tenant por `cod_agent`, fila de atendimento com posicao visivel, conteudo interativo na recepcao, e **link de gravacao acessivel diretamente no historico**.

---

## Arquitetura da Solucao

```text
Lead acessa link (/call/:roomName)
       |
       v
+----------------------------------------------+
|           RECEPCAO (Waiting Room)            |
|  - Preview de camera/microfone               |
|  - Carrossel de informativos                 |
|  - Posicao na fila: "Voce e o 3o"            |
|  - Subscription Realtime para detectar       |
|    quando operador entra                     |
+----------------------------------------------+
       |
       | [Evento Realtime: operator_joined_at != null]
       v
+----------------------------------------------+
|           SALA DE CHAMADA                    |
|  - Conexao automatica e instantanea          |
|  - Gravacao inicia automaticamente           |
+----------------------------------------------+
       |
       v
+----------------------------------------------+
|           HISTORICO COM GRAVACAO             |
|  - Link de download da gravacao              |
|  - Opcao de copiar link para compartilhar    |
|  - Status da gravacao em tempo real          |
+----------------------------------------------+
```

---

## Diferencial: Tempo Real vs Polling

| Aspecto | Polling (antigo) | Realtime (novo) |
|---------|------------------|-----------------|
| **Latencia** | 3-10 segundos | Instantaneo (<100ms) |
| **Consumo de rede** | Alto (requisicoes constantes) | Baixo (WebSocket persistente) |
| **Experiencia do usuario** | Atraso perceptivel | Transicao fluida |
| **Posicao na fila** | Atualiza com delay | Atualiza instantaneamente |
| **Escalabilidade** | Problematico com muitos leads | Otimizado para escala |

---

## Funcionalidades Principais

| Funcionalidade | Descricao |
|----------------|-----------|
| **Sala de Recepcao** | Lead aguarda com preview de camera antes de entrar |
| **Fila em Tempo Real** | Posicao na fila atualiza instantaneamente |
| **Conteudo Informativo** | Carrossel de textos/videos na espera |
| **Transicao Automatica** | Lead entra instantaneamente quando operador conecta |
| **Isolamento por cod_agent** | Cada cliente ve apenas filas/salas de seus agentes |
| **Gravacao Automatica** | Inicia quando lead entra na chamada |
| **Link de Gravacao no Historico** | Download e compartilhamento da gravacao |

---

## Modelo de Dados

### Alteracoes na tabela `video_call_records`

Adicionar novas colunas para controlar o estado da recepcao e gravacao:

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `lead_waiting_at` | timestamp | Quando o lead entrou na recepcao |
| `operator_joined_at` | timestamp | Quando o operador entrou na sala |
| `recording_url` | text | URL permanente da gravacao (quando disponivel) |

**Habilitar Realtime para a tabela:**
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.video_call_records;
```

---

## Link de Gravacao no Historico - Detalhamento

### Fluxo de Gravacao

```text
1. Operador entra na sala
       |
       v
2. Lead conecta automaticamente
       |
       v
3. Gravacao inicia (record-start)
       |
       v
4. Chamada encerra (close room)
       |
       v
5. Daily.co processa gravacao
       |
       v
6. Historico mostra status "Processando"
       |
       v
7. Gravacao pronta -> Link disponivel
       |
       v
8. Usuario pode: Download / Copiar Link
```

### Componentes de Gravacao

#### 1. RecordingDownloadButton (aprimorado)

Funcionalidades adicionadas:
- **Copiar link**: Opcao para copiar URL da gravacao
- **Status em tempo real**: Atualiza automaticamente quando gravacao fica pronta
- **Tooltip informativo**: Mostra tempo estimado de processamento

```text
+---------------------------------------+
| Status: Processando                   |
|   [Loader] ~2-5 min para ficar pronto |
+---------------------------------------+

+---------------------------------------+
| Gravacao Pronta                       |
|   [Download]  [Copiar Link]           |
+---------------------------------------+
```

#### 2. Nova coluna recording_url

Armazenar URL permanente apos gravacao ficar pronta:

```typescript
// Quando get-recording-link retorna sucesso, salvar URL
case 'get-recording-link': {
  const { recordingId } = body;
  
  const linkData = await getDailyRecordingLink(recordingId);
  
  // Salvar URL permanente no banco
  await supabase
    .from('video_call_records')
    .update({ 
      recording_status: 'ready',
      recording_url: linkData.download_link 
    })
    .eq('recording_id', recordingId);
  
  return { success: true, downloadLink: linkData.download_link };
}
```

#### 3. Historico com acoes de gravacao

```text
+------------------------------------------------------------------+
| Data/Hora | Operador | Contato | WhatsApp | Duracao | Gravacao   |
+------------------------------------------------------------------+
| 31/01 14:30 | Maria   | Joao    | +55...  | 12:45   | [Download] |
|             |         |         |         |         | [Copiar]   |
+------------------------------------------------------------------+
| 31/01 13:15 | Carlos  | Ana     | +55...  | 08:20   | Processando|
+------------------------------------------------------------------+
| 31/01 11:00 | Maria   | Pedro   | +55...  | 05:10   | Indisponivel|
+------------------------------------------------------------------+
```

---

## Fluxo Detalhado com Realtime

### 1. Lead acessa o link

```text
/call/:roomName
      |
      v
JoinCallPage.tsx
      |
      +- Busca dados da sala (action: 'join')
      +- Registra lead_waiting_at no banco
      +- Renderiza LeadWaitingRoom (NOVO)
```

### 2. Lead na Recepcao (Realtime Subscription)

O componente `LeadWaitingRoom`:
1. Mostra preview da camera/microfone
2. **Subscribes** na tabela `video_call_records` filtrando por `room_name`
3. Recebe atualizacoes instantaneas de posicao na fila
4. Exibe carrossel de informativos
5. Quando `operator_joined_at` muda para != null, transiciona automaticamente

```typescript
// Subscription Realtime para o lead
const channel = supabase
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
      if (payload.new.operator_joined_at) {
        // Operador entrou! Conectar automaticamente
        setReadyToJoin(true);
      }
    }
  )
  .subscribe();
```

### 3. Operador Atende (VideoQueuePage)

```text
1. Operador clica em "Atender" no VideoQueuePage
2. Sistema atualiza operator_joined_at na tabela
3. Evento Realtime e disparado instantaneamente
4. Lead recebe o evento e conecta automaticamente
5. Gravacao inicia quando lead entra
```

### 4. Fila de Atendimento em Tempo Real

Os operadores tambem recebem atualizacoes em tempo real:

```typescript
// Subscription para lista de salas
const channel = supabase
  .channel('video-queue')
  .on(
    'postgres_changes',
    {
      event: '*',  // INSERT, UPDATE, DELETE
      schema: 'public',
      table: 'video_call_records',
    },
    (payload) => {
      // Atualizar lista de salas instantaneamente
      refetchRooms();
    }
  )
  .subscribe();
```

### 5. Status de Gravacao em Tempo Real no Historico

```typescript
// Subscription para status de gravacao no historico
const channel = supabase
  .channel('recording-status')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'video_call_records',
      filter: `recording_status=neq.${currentStatus}`,
    },
    (payload) => {
      // Atualizar status da gravacao instantaneamente
      if (payload.new.recording_status === 'ready') {
        refetchHistory();
      }
    }
  )
  .subscribe();
```

---

## Componentes a Criar/Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/pages/video/components/LeadWaitingRoom.tsx` | **Criar** | Sala de recepcao com Realtime |
| `src/pages/video/components/QueuePositionIndicator.tsx` | **Criar** | Indicador de posicao em tempo real |
| `src/pages/video/components/InformativeCarousel.tsx` | **Criar** | Carrossel de informativos |
| `src/pages/video/hooks/useRealtimeQueue.ts` | **Criar** | Hook para subscription Realtime |
| `src/pages/video/components/RecordingDownloadButton.tsx` | **Modificar** | Adicionar opcao de copiar link |
| `src/pages/video/components/CallHistorySection.tsx` | **Modificar** | Realtime para status de gravacao |
| `src/pages/video/JoinCallPage.tsx` | **Modificar** | Integrar sala de recepcao |
| `src/pages/video/VideoQueuePage.tsx` | **Modificar** | Filtro por cod_agent + Realtime |
| `src/pages/video/hooks/useVideoRoom.ts` | **Modificar** | Adicionar acoes de fila e Realtime |
| `supabase/functions/video-room/index.ts` | **Modificar** | Logica de fila, isolamento e gravacao |

---

## Detalhes Tecnicos

### 1. RecordingDownloadButton Aprimorado

```typescript
interface RecordingDownloadButtonProps {
  recordingId: string;
  status: string | null;
  recordingUrl?: string | null;
}

export function RecordingDownloadButton({ 
  recordingId, 
  status, 
  recordingUrl 
}: RecordingDownloadButtonProps) {
  const { mutate: getLink, isPending } = useRecordingLink();
  const [downloadUrl, setDownloadUrl] = useState<string | null>(recordingUrl);

  const handleDownload = () => {
    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
      return;
    }
    
    getLink(recordingId, {
      onSuccess: (data) => {
        setDownloadUrl(data.downloadLink);
        window.open(data.downloadLink, '_blank');
      },
    });
  };

  const handleCopyLink = async () => {
    if (!downloadUrl) {
      getLink(recordingId, {
        onSuccess: async (data) => {
          setDownloadUrl(data.downloadLink);
          await navigator.clipboard.writeText(data.downloadLink);
          toast.success('Link copiado!');
        },
      });
      return;
    }
    
    await navigator.clipboard.writeText(downloadUrl);
    toast.success('Link copiado!');
  };

  if (status === 'ready' || downloadUrl) {
    return (
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={handleDownload}>
          <Download className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={handleCopyLink}>
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // ... outros status (processing, recording, etc)
}
```

### 2. Hook useRealtimeQueue

```typescript
interface UseRealtimeQueueOptions {
  roomName?: string;
  codAgents?: string[];
  onOperatorJoined?: () => void;
  onQueueUpdate?: () => void;
  onRecordingReady?: (recordId: string) => void;
}

export function useRealtimeQueue(options: UseRealtimeQueueOptions) {
  const { roomName, codAgents, onOperatorJoined, onQueueUpdate, onRecordingReady } = options;

  useEffect(() => {
    const channels: RealtimeChannel[] = [];

    // Subscription para sala especifica (lead)
    if (roomName) {
      const roomChannel = supabase
        .channel(`room-${roomName}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'video_call_records',
          filter: `room_name=eq.${roomName}`,
        }, (payload) => {
          if (payload.new.operator_joined_at && !payload.old.operator_joined_at) {
            onOperatorJoined?.();
          }
        })
        .subscribe();
      channels.push(roomChannel);
    }

    // Subscription para fila (operador)
    if (codAgents?.length) {
      const queueChannel = supabase
        .channel('video-queue')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'video_call_records',
        }, () => {
          onQueueUpdate?.();
        })
        .subscribe();
      channels.push(queueChannel);
    }

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, [roomName, codAgents, onOperatorJoined, onQueueUpdate, onRecordingReady]);
}
```

### 3. LeadWaitingRoom.tsx

```text
+--------------------------------------------------------+
|                                                        |
|  +--------------------------------------------------+  |
|  |              [Preview da Camera]                 |  |
|  |                                                  |  |
|  |                    [icone camera]                |  |
|  |                                                  |  |
|  +--------------------------------------------------+  |
|                                                        |
|              [Mic]    [Cam]    [Config]                |
|                                                        |
|  +--------------------------------------------------+  |
|  |         Voce e o 2o da fila                      |  |
|  |         [icone relogio] Aguardando atendente...  |  |
|  +--------------------------------------------------+  |
|                                                        |
|  +--------------------------------------------------+  |
|  |   [icone documento] Informativo 1 de 3           |  |
|  |   "Tenha seus documentos em maos para            |  |
|  |   agilizar o atendimento"                        |  |
|  |                        [indicador pagina]        |  |
|  +--------------------------------------------------+  |
|                                                        |
+--------------------------------------------------------+
```

### 4. Logica de Fila e Gravacao no Backend

Novas actions:

```typescript
case 'lead-waiting': {
  const { roomName } = body;
  
  // Registrar que o lead esta aguardando
  await supabase
    .from('video_call_records')
    .update({ lead_waiting_at: new Date().toISOString() })
    .eq('room_name', roomName);
  
  // Buscar posicao na fila
  const { data: room } = await supabase
    .from('video_call_records')
    .select('cod_agent')
    .eq('room_name', roomName)
    .single();
  
  const { data: queueRooms } = await supabase
    .from('video_call_records')
    .select('room_name, lead_waiting_at')
    .eq('cod_agent', room.cod_agent)
    .eq('status', 'pending')
    .is('operator_joined_at', null)
    .not('lead_waiting_at', 'is', null)
    .order('lead_waiting_at', { ascending: true });
  
  const position = queueRooms.findIndex(r => r.room_name === roomName) + 1;
  
  return { position, totalInQueue: queueRooms.length };
}

case 'operator-join': {
  const { roomName, operatorId, operatorName } = body;
  
  // Marcar que operador entrou - dispara evento Realtime automaticamente
  await supabase
    .from('video_call_records')
    .update({ 
      operator_joined_at: new Date().toISOString(),
      operator_id: operatorId,
      operator_name: operatorName,
    })
    .eq('room_name', roomName);
  
  return { success: true };
}
```

### 5. Isolamento por cod_agent (Multi-Tenant)

Na action `list`:

```typescript
case 'list': {
  const { codAgents } = body as ListRoomsRequest;
  
  let query = supabase
    .from('video_call_records')
    .select('*')
    .eq('status', 'pending')
    .not('lead_waiting_at', 'is', null)
    .is('operator_joined_at', null);
  
  // Aplicar filtro de isolamento multi-tenant
  if (codAgents && codAgents.length > 0) {
    query = query.in('cod_agent', codAgents);
  }
  
  const { data: rooms } = await query.order('lead_waiting_at');
  
  return { success: true, rooms };
}
```

---

## Migracao de Banco de Dados

```sql
-- Adicionar novas colunas para controle de fila e gravacao
ALTER TABLE video_call_records 
ADD COLUMN lead_waiting_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN operator_joined_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN recording_url TEXT;

-- Indice para otimizar consultas de fila
CREATE INDEX idx_video_call_records_queue 
ON video_call_records (cod_agent, status, lead_waiting_at) 
WHERE operator_joined_at IS NULL;

-- Indice para busca por recording_id
CREATE INDEX idx_video_call_records_recording 
ON video_call_records (recording_id) 
WHERE recording_id IS NOT NULL;

-- HABILITAR REALTIME para a tabela
ALTER PUBLICATION supabase_realtime ADD TABLE public.video_call_records;
```

---

## Seguranca e Isolamento

| Camada | Protecao |
|--------|----------|
| **Backend** | Filtro por `cod_agent` na listagem de salas |
| **Frontend** | Hook `useVideoRooms` recebe apenas `cod_agents` do usuario |
| **Realtime** | Channels filtrados por `cod_agent` |
| **Banco** | Indice otimizado para queries de fila por `cod_agent` |
| **Lead** | So ve posicao na fila do proprio `cod_agent` |
| **Gravacao** | Link de download expira em 1 hora |

---

## Diagrama de Eventos Realtime

```text
+----------------+        +------------------+        +----------------+
|     Lead       |        |    Supabase      |        |   Operador     |
|  (Waiting Room)|        |    Realtime      |        | (VideoQueue)   |
+----------------+        +------------------+        +----------------+
        |                         |                          |
        | Subscribe room-{name}   |                          |
        |------------------------>|                          |
        |                         |                          |
        |                         |   Subscribe video-queue  |
        |                         |<-------------------------|
        |                         |                          |
        | [Lead aguardando...]    |                          |
        |                         |                          |
        |                         |        Clica "Atender"   |
        |                         |<-------------------------|
        |                         |                          |
        |                         |  UPDATE operator_joined  |
        |                         |------------------------->|
        |                         |                          |
        | EVENT: operator_joined  |                          |
        |<------------------------|                          |
        |                         |                          |
        | [Conecta automatico!]   |                          |
        |                         |                          |
        | [Chamada em andamento]  |                          |
        |                         |                          |
        |                         |   Chamada encerrada      |
        |                         |<-------------------------|
        |                         |                          |
        |                         |  Gravacao processando    |
        |                         |------------------------->|
        |                         |                          |
        |                         |  Gravacao pronta         |
        |                         |------------------------->|
        |                         |                          |
        |                         |  [Historico atualiza]    |
        |                         |  [Link disponivel]       |
```

---

## Arquivos Finais

| Arquivo | Linhas Estimadas |
|---------|------------------|
| `LeadWaitingRoom.tsx` | ~350 |
| `QueuePositionIndicator.tsx` | ~80 |
| `InformativeCarousel.tsx` | ~120 |
| `useRealtimeQueue.ts` (novo) | ~120 |
| `RecordingDownloadButton.tsx` (modificado) | ~100 |
| `CallHistorySection.tsx` (modificado) | ~200 |
| `JoinCallPage.tsx` (modificado) | ~180 |
| `VideoQueuePage.tsx` (modificado) | ~280 |
| `useVideoRoom.ts` (modificado) | ~250 |
| `video-room/index.ts` (modificado) | ~800 |

---

## Resumo das Alteracoes

1. **Lead entra na recepcao** em vez de conectar diretamente
2. **Subscription Realtime** detecta entrada do operador instantaneamente
3. **Posicao na fila atualiza em tempo real** para todos os leads
4. **Lista de salas atualiza em tempo real** para operadores
5. **Transicao automatica e instantanea** quando operador conecta
6. **Gravacao automatica** apos conexao do lead
7. **Link de gravacao no historico** com opcao de download e copiar
8. **Status de gravacao em tempo real** (processando -> pronto)
9. **Isolamento por cod_agent** garante separacao entre clientes SaaS
10. **Eliminacao de polling** - apenas WebSocket persistente

