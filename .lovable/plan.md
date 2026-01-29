# Plano: Interface Customizada + Fila Condicional + Histórico de Chamadas

## Status de Implementação

| Item | Status |
|------|--------|
| Interface customizada (sem branding Daily.co) | ✅ **Implementado** |
| Fila condicional (lead já na sala) | ✅ **Implementado** |
| Histórico de chamadas na página | ✅ **Implementado** |
| Registro automático de chamadas | ✅ **Implementado** |
| Transcrição com IA | ⏸️ Adiado |
| Resumo com IA | ⏸️ Adiado |

## Arquitetura Implementada

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                           FLUXO COMPLETO                                    │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Operador cria sala no CRM → Registro com status 'pending'              │
│  2. Operador envia link ao lead via WhatsApp                               │
│  3. Lead abre link → Página customizada (sem branding Daily.co)            │
│  4. Lead entra na sala → Daily.co detecta participante                     │
│  5. Sala aparece na FILA do operador                                       │
│  6. Operador atende → Registro atualizado para 'active'                    │
│  7. Chamada encerra → Registro com 'completed' e duração calculada         │
│  8. Histórico fica disponível na página de videochamadas                   │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

## Componentes Criados

### Frontend

1. **CustomVideoCall.tsx** - Interface de vídeo para o operador (sem branding)
2. **LeadVideoCall.tsx** - Interface de vídeo para o lead (sem branding)  
3. **VideoTile.tsx** - Tile individual de vídeo com indicador de áudio
4. **VideoControls.tsx** - Controles customizados em português
5. **CallHistorySection.tsx** - Tabela de histórico de chamadas
6. **useCallHistory.ts** - Hook para buscar histórico via Edge Function

### Backend (Edge Function video-room)

Ações implementadas:
- `create` - Cria sala e registro no banco
- `list` - Lista apenas salas com participantes ativos
- `close` - Fecha sala e calcula duração
- `join` - Busca URL da sala para lead entrar
- `record-start` - Registra início da chamada
- `record-end` - Registra fim e calcula duração
- `history` - Retorna histórico de chamadas

### Banco de Dados

Tabela `video_call_records`:
- id, room_name, lead_id, cod_agent
- operator_name, contact_name, whatsapp_number
- started_at, ended_at, duration_seconds
- status (pending/active/completed)
- created_at

## Itens Adiados (Fase Futura)

| Item | Descrição |
|------|-----------|
| Transcrição com IA | ElevenLabs STT para converter áudio em texto |
| Resumo com IA | Lovable AI (Gemini) para gerar insights |
| Storage de gravações | Bucket para armazenar MP4s |
| Gravação automática | Requer conta Daily.co paga |
