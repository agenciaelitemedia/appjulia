## Objetivo

1. Mostrar botão "Gerar transcrição" em áudios que ainda não possuem transcrição.
2. Garantir que o resumo automático sempre considere o conteúdo de áudios (transcrevendo o que falta antes de resumir).

## Mudanças

### 1. Frontend — botão manual de transcrição
**`src/components/chat/messages/TranscriptionBlock.tsx`**
- Aceitar novas props: `messageId`, `canGenerate?: boolean`, `onGenerated?: () => void`.
- Quando `!transcription && canGenerate`, renderizar um bloco compacto com botão **"Gerar transcrição"** (ícone Sparkles + Loader2 enquanto roda).
- Ao clicar: `supabase.functions.invoke('chat-transcribe-audio', { body: { message_id } })`, mostrar loading, exibir resultado ou erro inline; chamar `onGenerated` para refetch.

**`src/components/chat/MessageBubble.tsx`** (case `audio`/`ptt`)
- Sempre renderizar `<TranscriptionBlock>` (remover o guard `message.metadata?.transcription &&`).
- Passar `messageId={message.id}`, `canGenerate` apenas quando a flag de transcrição estiver habilitada para a fila (já existe via `useEffectiveQueueFlags`/`useClientAutomationFlags` no contexto do chat — usar o hook mais leve disponível, ou simplesmente sempre habilitar e deixar o edge function responder "feature disabled" se aplicável).
- `onGenerated`: invalidar a query de mensagens da conversa (React Query key `['chat-messages', conversationId]`).

### 2. Backend — usar transcrições no resumo
**`supabase/functions/chat-ai-assist/index.ts`** (modo `incremental_summary`)
- Antes de montar o `transcript`, identificar mensagens `type IN ('audio','ptt')` sem `metadata.transcription.text` e com `external_id`.
- Para cada uma (limite ~10, em paralelo com `Promise.allSettled`), invocar `chat-transcribe-audio` internamente via `fetch` ao próprio endpoint do projeto (SERVICE_ROLE) e aguardar.
- Recarregar essas mensagens (`select metadata`) e mesclar no array `msgs` antes de chamar `renderMessageForTranscript`. O renderizador já inclui o texto transcrito (linhas 61–69).
- Falhas continuam como `[Áudio sem transcrição]` — comportamento atual preservado.

### 3. Sem mudanças de banco
Esquema atual (`chat_messages.metadata.transcription`) já suporta tudo.

## Validação
- Abrir um áudio sem transcrição em `/chat` → ver botão, clicar, ver transcrição aparecer.
- Resolver/encerrar uma conversa com áudios sem transcrição → checar resumo automático contém o conteúdo dos áudios.