# Refinar alerta sonoro de novas mensagens

Hoje `useNewMessageSound` (montado no `MainLayout`) toca o som em qualquer mensagem recebida do `client_id` do usuário. Vamos adicionar dois filtros adicionais.

## Mudanças

### 1. Não tocar durante gravação/envio de áudio
Criar um pequeno store de "atividade de áudio" para sinalizar globalmente quando o usuário está gravando ou enviando um áudio no chat.

- Novo arquivo `src/lib/chat/audioActivity.ts`:
  - Mantém um contador interno (`activeCount`) — suporta múltiplas instâncias eventuais.
  - Exporta `setAudioActivity(active: boolean)` e `isAudioActive(): boolean`.
- `src/components/chat/AudioRecorder.tsx`:
  - `useEffect` que chama `setAudioActivity(true)` ao montar e `setAudioActivity(false)` ao desmontar.
  - Garante ativação também enquanto `isSending` for verdadeiro (cobre o intervalo entre parar a gravação e o envio concluir).
- `useNewMessageSound`: antes de tocar, sai cedo se `isAudioActive()` retornar `true`.

### 2. Só alertar para conversas pendentes ou atribuídas ao usuário logado
A regra é: tocar somente se a conversa da mensagem estiver em status `pending` (sem atendente) OU `assigned_to === user.id` do usuário logado. Mensagens de conversas atribuídas a outro atendente são ignoradas.

Como o payload Realtime de `chat_messages` não carrega `assigned_to`/`status`, faremos uma consulta leve a `chat_conversations` no momento do alerta:

- Em `useNewMessageSound`, dentro do handler `INSERT`:
  - Após validar dedup/tipo, ler `msg.conversation_id` do payload.
  - Se não houver `conversation_id`, manter o comportamento atual (tocar — fallback seguro para mensagens fora de ticket).
  - Caso contrário, `supabase.from('chat_conversations').select('status, assigned_to').eq('id', conversation_id).maybeSingle()`.
  - Tocar somente se `status === 'pending'` OU `String(assigned_to) === String(user.id)`.
  - Em erro de consulta, falhar silenciosamente sem tocar (evita ruído indevido).
- O throttle e o gate de `settings.enabled`/`mutedUsers` permanecem inalterados.

## Detalhes técnicos

- O store de áudio é um módulo simples (sem React state) para não exigir Context novo e funcionar a partir do `AudioRecorder` em qualquer página.
- Nada muda em `ChatInput.tsx` — o `AudioRecorder` é montado/desmontado conforme `isRecording`, então o ciclo de vida cobre toda a janela "gravando + enviando".
- Não alteramos lógica de negócio do chat (envio, atribuição, status). Mudança fica isolada em alerta sonoro + flag de áudio.

## Arquivos afetados

- `src/lib/chat/audioActivity.ts` (novo)
- `src/components/chat/AudioRecorder.tsx` (efeito de sinalização)
- `src/hooks/useNewMessageSound.ts` (dois novos gates)
