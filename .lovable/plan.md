## Problema

Em `src/components/chat/MessageBubble.tsx` (linha ~358) o `<TranscriptionBlock canGenerate />` está com `canGenerate` **hardcoded como `true`**, então o botão "Gerar transcrição" aparece para qualquer cliente em qualquer fila, ignorando as flags master (client) e por fila (queue).

A regra correta (já usada nas automações server-side em `fetchEffectiveQueueFlags`) é:

```
mostrar botão = chat_client_settings.settings.auto_transcribe_audio === true
              AND queues.settings.auto_transcribe_audio === true
```

## Correção

### 1. Novo hook `src/hooks/useQueueAutomationFlags.ts`
Lê `queues.settings` da fila informada e devolve `{ autoTranscribeAudio, autoSummaryOnResolve, autoSummaryOnClose }`. Cache `staleTime: 5min`, `enabled: !!queueId`.

### 2. `src/components/chat/MessageBubble.tsx`
- Importar `useClientAutomationFlags` e `useQueueAutomationFlags`.
- Pegar `queue_id` da mensagem (`message.queue_id`) — se não existir no tipo, fallback para `useWhatsAppData().selectedQueue?.id`.
- Calcular:
  ```ts
  const canTranscribe =
    clientFlags.autoTranscribeAudio && queueFlags.autoTranscribeAudio;
  ```
- Passar `canGenerate={canTranscribe}` no `<TranscriptionBlock>`.

Resultado: o `TranscriptionBlock` já retorna `null` quando `!canGenerate && !hasTranscription`, então o botão some automaticamente para clientes/filas sem permissão. Mensagens que **já têm** transcrição continuam exibindo o texto (correto — não esconder histórico).

### 3. (opcional, mesma sessão) Aplicar o mesmo gate no botão de transcrição manual fora do bubble, se existir.

## Detalhes técnicos

- A flag por client vive em `chat_client_settings.settings.auto_transcribe_audio` (gerenciada em `/admin/chat → Inteligência de Atendimento`).
- A flag por fila vive em `queues.settings.auto_transcribe_audio` (toggle no card de fila em `/agente/filas`).
- Server-side (webhook `chat-transcribe-audio` / `uazapi-chat-webhook`) já usa `fetchEffectiveQueueFlags` para validar — o frontend só estava desalinhado.
- Sem mudanças de schema, sem migration.

## Arquivos afetados
- `src/hooks/useQueueAutomationFlags.ts` (novo)
- `src/components/chat/MessageBubble.tsx` (edição pontual)
