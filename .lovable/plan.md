

# Plano: Implementar Gravacao de Videochamadas na Nuvem do Daily.co

## Resumo Executivo

Este plano implementa gravacao automatica de videochamadas utilizando a API de Cloud Recording do Daily.co. As gravacoes serao armazenadas na nuvem do Daily.co e links de download serao disponibilizados no historico.

---

## Como Funciona a Gravacao do Daily.co

### Fluxo de Gravacao
```text
1. Sala criada com enable_recording: "cloud"
2. Operador entra na sala
3. POST /rooms/:name/recordings/start → inicia gravacao
4. Chamada acontece normalmente
5. POST /rooms/:name/recordings/stop → para gravacao
6. Daily.co processa e gera arquivo MP4
7. GET /recordings/:id/access-link → obtem URL de download
```

### Endpoints da API
| Endpoint | Metodo | Funcao |
|----------|--------|--------|
| `/rooms` (create) | POST | Habilitar gravacao com `enable_recording: "cloud"` |
| `/rooms/:name/recordings/start` | POST | Iniciar gravacao |
| `/rooms/:name/recordings/stop` | POST | Parar gravacao (retorna `recording_id`) |
| `/recordings/:id` | GET | Status da gravacao |
| `/recordings/:id/access-link` | GET | Link de download (valido por 1h) |

---

## Alteracoes no Banco de Dados

Adicionar colunas para armazenar informacoes da gravacao:

```sql
ALTER TABLE video_call_records 
ADD COLUMN recording_id text,
ADD COLUMN recording_status text DEFAULT 'none';
-- Status: 'none' | 'recording' | 'processing' | 'ready' | 'error'
```

---

## Alteracoes na Edge Function `video-room`

### A) Acao `create` - Habilitar gravacao na sala

Adicionar `enable_recording: "cloud"` nas propriedades da sala:

```typescript
body: JSON.stringify({
  name: roomName,
  privacy: 'public',
  properties: {
    exp: Math.floor(Date.now() / 1000) + 3600,
    enable_chat: true,
    enable_screenshare: true,
    enable_recording: 'cloud',  // NOVO: habilita gravacao
    // ... demais propriedades
  },
}),
```

### B) Acao `record-start` - Iniciar gravacao via API

Alem de atualizar o banco, chamar a API do Daily.co:

```typescript
case 'record-start': {
  const { roomName, operatorId, operatorName } = body;
  
  // Iniciar gravacao via API Daily.co
  const startResponse = await fetch(
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
        maxDuration: 3600, // 1 hora max
      }),
    }
  );
  
  // Atualizar banco com status
  await supabase
    .from('video_call_records')
    .update({ 
      started_at: new Date().toISOString(),
      operator_id: operatorId,
      operator_name: operatorName,
      recording_status: 'recording',
      status: 'active' 
    })
    .eq('room_name', roomName);

  return new Response(
    JSON.stringify({ success: true, message: 'Recording started' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

### C) Acao `close` - Parar gravacao e capturar recording_id

```typescript
case 'close': {
  const { roomName } = body;
  
  // Parar gravacao via API Daily.co
  const stopResponse = await fetch(
    `${DAILY_API_URL}/rooms/${roomName}/recordings/stop`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${DAILY_API_KEY}` },
    }
  );
  
  let recordingId = null;
  if (stopResponse.ok) {
    const stopData = await stopResponse.json();
    recordingId = stopData.id; // ID da gravacao
  }
  
  // Atualizar banco com recording_id
  await supabase
    .from('video_call_records')
    .update({ 
      ended_at: new Date().toISOString(),
      duration_seconds: durationSeconds,
      recording_id: recordingId,
      recording_status: recordingId ? 'processing' : 'error',
      status: 'completed' 
    })
    .eq('room_name', roomName);
  
  // ... deletar sala
}
```

### D) Nova acao `get-recording-link` - Obter link de download

```typescript
interface GetRecordingLinkRequest {
  action: 'get-recording-link';
  recordingId: string;
}

case 'get-recording-link': {
  const { recordingId } = body;
  
  const linkResponse = await fetch(
    `${DAILY_API_URL}/recordings/${recordingId}/access-link?valid_for_secs=3600`,
    {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${DAILY_API_KEY}` },
    }
  );
  
  if (!linkResponse.ok) {
    throw new Error('Recording not ready or not found');
  }
  
  const linkData = await linkResponse.json();
  
  // Atualizar status para 'ready' se ainda nao estava
  await supabase
    .from('video_call_records')
    .update({ recording_status: 'ready' })
    .eq('recording_id', recordingId);
  
  return new Response(
    JSON.stringify({ 
      success: true, 
      downloadLink: linkData.download_link,
      expiresAt: new Date(linkData.expires * 1000).toISOString(),
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

---

## Alteracoes no Frontend

### A) Novo hook `useRecordingLink`

```typescript
export function useRecordingLink() {
  return useMutation({
    mutationFn: async (recordingId: string) => {
      const { data, error } = await supabase.functions.invoke('video-room', {
        body: {
          action: 'get-recording-link',
          recordingId,
        },
      });
      
      if (error) throw error;
      return data;
    },
  });
}
```

### B) Atualizar `CallHistorySection` - Botao de download

Adicionar coluna "Gravacao" na tabela com botao de download:

```tsx
<TableHead>Gravacao</TableHead>

// Na linha:
<TableCell>
  {record.recording_id ? (
    <RecordingDownloadButton 
      recordingId={record.recording_id}
      status={record.recording_status}
    />
  ) : (
    <span className="text-muted-foreground text-sm">-</span>
  )}
</TableCell>
```

### C) Componente `RecordingDownloadButton`

```tsx
function RecordingDownloadButton({ recordingId, status }: Props) {
  const { mutate: getLink, isPending } = useRecordingLink();
  
  const handleDownload = () => {
    getLink(recordingId, {
      onSuccess: (data) => {
        window.open(data.downloadLink, '_blank');
      },
      onError: () => {
        toast.error('Gravacao ainda em processamento. Tente novamente em alguns minutos.');
      },
    });
  };
  
  if (status === 'processing') {
    return (
      <Badge variant="outline" className="text-yellow-600">
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        Processando
      </Badge>
    );
  }
  
  if (status === 'error') {
    return <Badge variant="destructive">Erro</Badge>;
  }
  
  return (
    <Button 
      variant="ghost" 
      size="sm"
      onClick={handleDownload}
      disabled={isPending}
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
    </Button>
  );
}
```

---

## Atualizar Types

```typescript
// types.ts
export interface CallHistoryRecord {
  // ... campos existentes
  recording_id: string | null;      // NOVO
  recording_status: string | null;  // NOVO: 'none'|'recording'|'processing'|'ready'|'error'
}
```

---

## Fluxo Completo

```text
┌────────────────────────────────────────────────────────────────────┐
│ 1. Agente envia link para lead                                     │
│    → action: 'create' com enable_recording: 'cloud'                │
│    → recording_status: 'none'                                      │
├────────────────────────────────────────────────────────────────────┤
│ 2. Operador clica em "Atender"                                     │
│    → action: 'record-start'                                        │
│    → POST /rooms/:name/recordings/start                            │
│    → recording_status: 'recording'                                 │
├────────────────────────────────────────────────────────────────────┤
│ 3. Chamada em andamento (gravacao ativa)                           │
│    → Daily.co grava audio/video na nuvem                           │
├────────────────────────────────────────────────────────────────────┤
│ 4. Operador encerra chamada                                        │
│    → action: 'close'                                               │
│    → POST /rooms/:name/recordings/stop → retorna recording_id      │
│    → recording_status: 'processing'                                │
├────────────────────────────────────────────────────────────────────┤
│ 5. Daily.co processa gravacao (1-5 minutos)                        │
│    → Arquivo MP4 disponivel na nuvem                               │
├────────────────────────────────────────────────────────────────────┤
│ 6. Operador clica no botao de download no historico                │
│    → action: 'get-recording-link'                                  │
│    → GET /recordings/:id/access-link                               │
│    → Abre link de download (valido por 1 hora)                     │
│    → recording_status: 'ready'                                     │
└────────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/video-room/index.ts` | Habilitar gravacao, start/stop recording, get-link |
| `src/pages/video/types.ts` | Adicionar recording_id e recording_status |
| `src/pages/video/hooks/useCallHistory.ts` | Adicionar useRecordingLink mutation |
| `src/pages/video/components/CallHistorySection.tsx` | Adicionar coluna e botao de download |

---

## Migracao SQL

```sql
ALTER TABLE video_call_records 
ADD COLUMN recording_id text,
ADD COLUMN recording_status text DEFAULT 'none';

CREATE INDEX idx_video_call_records_recording_id 
ON video_call_records(recording_id);
```

---

## Consideracoes de Custo

O Daily.co cobra pela gravacao em nuvem:
- Gravacao: aproximadamente $0.02/minuto por participante
- Armazenamento: os arquivos ficam disponiveis por 7 dias por padrao
- Para retencao maior, considere copiar para storage proprio (S3, Supabase Storage)

---

## Beneficios da Implementacao

1. **Gravacao automatica**: Toda chamada sera gravada sem acao manual
2. **Armazenamento na nuvem**: Nenhum custo de storage proprio (por 7 dias)
3. **Links temporarios**: Seguranca com links que expiram em 1 hora
4. **Processamento assíncrono**: Nao impacta performance da chamada
5. **Historico completo**: Operadores e admins podem revisar atendimentos

