
## Objetivo
Implementar as seguintes melhorias na Sala de Reuniao:
1. Identificar o operador logado ao atender uma sala
2. Criar abas para separar "Atendimento" do "Historico"
3. Filtrar o historico por perfil: admins veem todos, outros veem apenas seus atendimentos
4. Preparar estrutura para gravacoes (futuro)

---

## Analise do Estado Atual

### Tabela `video_call_records`
Colunas atuais:
- `id`, `room_name`, `lead_id`, `cod_agent`
- `operator_name` (texto livre - nao rastreavel)
- `contact_name`, `whatsapp_number`
- `started_at`, `ended_at`, `duration_seconds`
- `status`, `created_at`

**Problema**: Nao existe `operator_id` para identificar o usuario que atendeu.

### Autenticacao
O sistema usa `AuthContext` com usuario do banco externo:
- `user.id` (number) - identificador unico
- `user.name` - nome do operador
- `user.role` - 'admin' | 'manager' | 'agent' | 'time'

---

## Plano de Implementacao

### A) Alterar banco de dados
Adicionar coluna `operator_id` (integer, nullable) para vincular ao usuario que atendeu.

```sql
ALTER TABLE video_call_records 
ADD COLUMN operator_id integer;

CREATE INDEX idx_video_call_records_operator_id 
ON video_call_records(operator_id);
```

### B) Atualizar Edge Function `video-room`

#### B.1 Acao `record-start`
Receber `operatorId` e `operatorName` do frontend:

```typescript
interface RecordStartRequest {
  action: 'record-start';
  roomName: string;
  operatorId?: number;    // NOVO
  operatorName?: string;
}
```

#### B.2 Acao `history` - Filtro por perfil
Receber `operatorId` e `isAdmin` para filtrar:

```typescript
interface GetHistoryRequest {
  action: 'history';
  limit?: number;
  operatorId?: number;  // NOVO
  isAdmin?: boolean;    // NOVO
}

// Logica:
if (isAdmin) {
  // Retorna todos os registros
} else {
  // Filtra por operator_id = operatorId
}
```

### C) Atualizar Frontend

#### C.1 Hook `useCallHistory`
Enviar `operatorId` e `isAdmin` do usuario logado:

```typescript
export function useCallHistory(limit = 50) {
  const { user, isAdmin } = useAuth();
  
  return useQuery({
    queryKey: ['video-call-history', limit, user?.id, isAdmin],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke('video-room', {
        body: {
          action: 'history',
          limit,
          operatorId: user?.id,
          isAdmin,
        },
      });
      return data.records;
    },
  });
}
```

#### C.2 Pagina `VideoQueuePage`
Enviar dados do operador ao iniciar atendimento:

```typescript
const handleJoinRoom = useCallback(async (room: VideoRoom) => {
  await supabase.functions.invoke('video-room', {
    body: {
      action: 'record-start',
      roomName: room.name,
      operatorId: user?.id,       // NOVO
      operatorName: user?.name,
    },
  });
  setActiveRoom(room);
}, [user]);
```

#### C.3 Criar Layout com Abas
Reestruturar a pagina com `Tabs` do Radix:

```text
┌─────────────────────────────────────────────────────┐
│ [Icone] Sala de Reuniao              [Atualizar]    │
├─────────────────────────────────────────────────────┤
│   [Atendimento]     [Historico]    <-- Abas         │
├─────────────────────────────────────────────────────┤
│                                                     │
│   Conteudo da aba selecionada                       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Aba Atendimento**: Layout atual (fila + video)
**Aba Historico**: Tabela expandida com todos os registros

### D) Sobre Gravacoes (Informativo)

A API do Daily.co suporta gravacoes via:
- `POST /rooms/:name/recordings/start` - Iniciar gravacao
- `POST /rooms/:name/recordings/stop` - Parar gravacao
- `GET /recordings` - Listar gravacoes

Para habilitar, seria necessario:
1. Chamar `start` ao iniciar atendimento
2. Chamar `stop` ao encerrar
3. Armazenar `recording_id` na tabela
4. Criar acao `get-recordings` para buscar URLs

**Recomendacao**: Implementar em fase posterior, pois requer:
- Armazenamento adicional (videos sao grandes)
- Player de video na UI
- Custo adicional do Daily.co para gravacoes em nuvem

---

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/video-room/index.ts` | Receber operatorId em record-start e filtrar history |
| `src/pages/video/VideoQueuePage.tsx` | Adicionar Tabs, enviar user ao record-start |
| `src/pages/video/hooks/useCallHistory.ts` | Enviar operatorId e isAdmin |
| `src/pages/video/components/CallHistorySection.tsx` | Exibir coluna de operador, ajustar scroll |

---

## Migracao SQL

```sql
-- Adicionar coluna operator_id
ALTER TABLE video_call_records 
ADD COLUMN operator_id integer;

-- Indice para filtros por operador
CREATE INDEX idx_video_call_records_operator_id 
ON video_call_records(operator_id);
```

---

## Fluxo Final

```text
1. Operador (user.id=5, role='agent') acessa /video/queue
2. Ve aba "Atendimento" com fila de leads
3. Clica em "Atender"
4. Frontend envia record-start com operatorId=5, operatorName='João'
5. Backend salva operator_id=5 no registro
6. Operador finaliza chamada
7. Operador clica em aba "Historico"
8. Frontend envia history com operatorId=5, isAdmin=false
9. Backend retorna apenas registros WHERE operator_id=5
10. Se fosse admin (role='admin'):
    - Backend retorna TODOS os registros
```

---

## Resultado Esperado

- Operadores nao-admin verao apenas seus proprios atendimentos
- Admins verao todos os atendimentos de todos os operadores
- O campo `operator_name` continuara sendo gravado para display
- O campo `operator_id` permitira filtros e vinculos futuros
- Interface com abas separa claramente atendimento ativo do historico
