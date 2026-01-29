
# Plano Atualizado: Interface Customizada + Fila Condicional + Histórico de Chamadas

## Alterações no Escopo

| Item | Status |
|------|--------|
| Interface customizada (sem branding Daily.co) | ✅ Mantido |
| Fila condicional (lead já na sala) | ✅ Mantido |
| Gravação de chamadas | ✅ Mantido |
| Histórico de chamadas na página | ✅ **NOVO** |
| Transcrição com IA | ⏸️ Adiado |
| Resumo com IA | ⏸️ Adiado |

## Arquitetura do Sistema

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                           FLUXO COMPLETO                                    │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Operador cria sala no CRM → Sala INVISÍVEL na fila                     │
│  2. Operador envia link ao lead via WhatsApp                               │
│  3. Lead abre link → Página customizada (sem branding Daily.co)            │
│  4. Lead entra na sala → Daily.co detecta participante                     │
│  5. Sala aparece na FILA do operador                                       │
│  6. Operador atende → Sistema registra início da chamada                   │
│  7. Chamada encerra → Sistema registra fim e duração                       │
│  8. Histórico fica disponível na página de videochamadas                   │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

## Parte 1: Interface Customizada para o Lead (Sem Branding)

### Nova Dependência

```bash
npm install @daily-co/daily-react jotai
```

### Novos Componentes

**`src/pages/video/components/CustomVideoCall.tsx`**
- Usa `@daily-co/daily-react` para renderizar vídeos manualmente
- Remove completamente o "Powered by Daily"
- Interface limpa: vídeo principal + PIP da própria câmera

**`src/pages/video/components/VideoTile.tsx`**
- Tile individual para cada participante
- Indicador de áudio ativo
- Borda quando falando

**`src/pages/video/components/VideoControls.tsx`**
- Controles customizados em português
- Microfone, câmera, encerrar chamada
- Design clean e intuitivo

### Design da Interface

```text
┌─────────────────────────────────────────────────────────────────┐
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                                                               │ │
│  │                    VIDEO DO OPERADOR                         │ │
│  │                    (tela principal)                          │ │
│  │                                                               │ │
│  │                                               ┌─────────┐    │ │
│  │                                               │ MINHA   │    │ │
│  │                                               │ CAMERA  │    │ │
│  │                                               └─────────┘    │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │    🎤 Mic      📹 Câm      📞 Encerrar                       │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Parte 2: Fila Condicional (Lead já na sala)

### Modificação na Edge Function

O action `list` em `video-room/index.ts` será modificado para:

1. Listar todas as salas Julia existentes
2. Para cada sala, consultar `/meetings?room={name}&ongoing=true`
3. Retornar apenas salas com participantes ativos

```typescript
// Pseudo-código
case 'list': {
  const rooms = await listJuliaRooms();
  
  const roomsWithParticipants = await Promise.all(
    rooms.map(async (room) => {
      const meeting = await checkOngoingMeeting(room.name);
      return meeting.hasParticipants ? room : null;
    })
  );
  
  return roomsWithParticipants.filter(Boolean);
}
```

## Parte 3: Histórico de Chamadas

### Nova Tabela no Banco de Dados

```sql
CREATE TABLE video_call_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_name TEXT NOT NULL,
  lead_id BIGINT,
  cod_agent TEXT NOT NULL,
  operator_name TEXT,
  contact_name TEXT,
  whatsapp_number TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_seconds INT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para busca
CREATE INDEX idx_video_call_records_cod_agent ON video_call_records(cod_agent);
CREATE INDEX idx_video_call_records_created_at ON video_call_records(created_at DESC);
```

### Novo Hook: `useCallHistory`

```typescript
// src/pages/video/hooks/useCallHistory.ts
export function useCallHistory() {
  return useQuery({
    queryKey: ['video-call-history'],
    queryFn: async () => {
      // Busca últimas 50 chamadas
      const { data } = await supabase
        .from('video_call_records')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      return data;
    },
  });
}
```

### Novo Componente: `CallHistorySection`

```typescript
// src/pages/video/components/CallHistorySection.tsx
// Exibe tabela com:
// - Data/Hora
// - Operador (quem fez)
// - Contato (para quem)
// - WhatsApp
// - Duração
// - Status
```

### Atualização da Página VideoQueuePage

O layout será modificado para incluir uma seção de histórico abaixo da área de vídeo:

```text
┌────────────────────────────────────────────────────────────────┐
│ FILA (1/3)        │  VÍDEO ATIVO (2/3)                         │
│                   │                                             │
│  [Lead 1]         │  ┌─────────────────────────────────────┐   │
│  [Lead 2]         │  │                                      │   │
│                   │  │         Videochamada                 │   │
│                   │  │                                      │   │
│                   │  └─────────────────────────────────────┘   │
├───────────────────┴─────────────────────────────────────────────┤
│  HISTÓRICO DE CHAMADAS                                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Data      │ Operador │ Contato    │ WhatsApp │ Duração    │ │
│  │ 29/01 10h │ João     │ Maria      │ +55...   │ 15:32      │ │
│  │ 29/01 09h │ Ana      │ Pedro      │ +55...   │ 08:45      │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Parte 4: Registro Automático de Chamadas

### Fluxo de Registro

1. **Ao criar sala** → Cria registro com status `pending`
2. **Ao operador atender** → Atualiza `started_at` e status para `active`
3. **Ao encerrar** → Atualiza `ended_at`, calcula `duration_seconds`, status `completed`

### Modificações na Edge Function

Adicionar actions:
- `record-start`: Registra início da chamada
- `record-end`: Registra fim e calcula duração

## Resumo das Alterações

| Arquivo | Alteração | Prioridade |
|---------|-----------|------------|
| `package.json` | Adicionar `@daily-co/daily-react` e `jotai` | Alta |
| `src/pages/video/components/CustomVideoCall.tsx` | **NOVO** - UI sem branding | Alta |
| `src/pages/video/components/VideoTile.tsx` | **NOVO** - Tile de vídeo | Alta |
| `src/pages/video/components/VideoControls.tsx` | **NOVO** - Controles PT-BR | Alta |
| `src/pages/video/JoinCallPage.tsx` | Refatorar para usar CustomVideoCall | Alta |
| `supabase/functions/video-room/index.ts` | Filtrar fila por participantes ativos | Média |
| `supabase/functions/video-room/index.ts` | Actions record-start e record-end | Média |
| **Banco de dados** | Tabela `video_call_records` | Média |
| `src/pages/video/hooks/useCallHistory.ts` | **NOVO** - Hook para histórico | Média |
| `src/pages/video/components/CallHistorySection.tsx` | **NOVO** - Seção de histórico | Média |
| `src/pages/video/VideoQueuePage.tsx` | Adicionar seção de histórico | Média |

## Dependências Externas

| Recurso | Status | Observação |
|---------|--------|------------|
| `@daily-co/daily-react` | Precisa instalar | Para UI customizada |
| `jotai` | Precisa instalar | Peer dependency |
| Daily.co Recording | Requer plano pago | ~$0.04/min (opcional) |

## Itens Adiados (Fase Futura)

| Item | Descrição |
|------|-----------|
| Transcrição com IA | ElevenLabs STT para converter áudio em texto |
| Resumo com IA | Lovable AI (Gemini) para gerar insights |
| Storage de gravações | Bucket para armazenar MP4s |

## Ordem de Implementação

1. **Fase 1** - Interface Customizada
   - Instalar dependências npm
   - Criar CustomVideoCall, VideoTile, VideoControls
   - Refatorar JoinCallPage

2. **Fase 2** - Fila Condicional
   - Modificar action `list` na Edge Function

3. **Fase 3** - Histórico de Chamadas
   - Criar tabela `video_call_records`
   - Criar hook useCallHistory
   - Criar componente CallHistorySection
   - Atualizar VideoQueuePage

4. **Fase 4** - Registro Automático
   - Adicionar actions record-start e record-end
   - Integrar com fluxo de chamada

## Seção Técnica: Daily React Hooks

### Hooks Principais

```typescript
// useLocalParticipant - Dados do usuário local
const localParticipant = useLocalParticipant();

// useParticipantIds - IDs dos participantes remotos
const remoteIds = useParticipantIds({ filter: 'remote' });

// useDaily - Acesso ao call object
const daily = useDaily();
daily.setLocalAudio(false); // Mutar
daily.setLocalVideo(false); // Desligar câmera

// useDailyEvent - Escutar eventos
useDailyEvent('joined-meeting', () => console.log('Entrou!'));
```

### Componentes do Daily React

```tsx
// DailyVideo - Renderiza vídeo de um participante
<DailyVideo sessionId="abc123" type="video" />

// DailyAudio - Gerencia áudio de todos (invisível)
<DailyAudio />
```

### Estrutura do CustomVideoCall

```tsx
function CustomVideoCall({ roomUrl, onLeave }) {
  const localParticipant = useLocalParticipant();
  const remoteIds = useParticipantIds({ filter: 'remote' });
  
  return (
    <div className="h-screen w-screen bg-slate-900">
      {/* Vídeo remoto (tela cheia) */}
      {remoteIds[0] && (
        <DailyVideo sessionId={remoteIds[0]} className="w-full h-full" />
      )}
      
      {/* Minha câmera (PIP) */}
      <div className="absolute bottom-24 right-4 w-32 h-24">
        <DailyVideo sessionId={localParticipant?.session_id} />
      </div>
      
      {/* Controles */}
      <VideoControls onLeave={onLeave} />
      
      {/* Áudio */}
      <DailyAudio />
    </div>
  );
}
```
