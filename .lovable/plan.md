## Objetivo
1. Garantir que todo resumo gerado automaticamente (auto_resolve / auto_close) apareça também na aba **Resumos** com período (início → fim) e quantidade de mensagens claramente identificados.
2. Garantir que mensagens de áudio usem a transcrição (quando existir) tanto no resumo manual quanto no automático.

## Diagnóstico
- `incremental_summary` (usado pelo auto-resumo) **já** insere em `chat_conversation_summaries` com `first_message_ts`, `last_message_ts` e `message_count`. ✓
- `renderMessageForTranscript` já injeta `[Áudio transcrito] {texto}` quando há transcrição (vale para os dois modos). ✓
- Problemas reais a corrigir:
  - **UI da aba Resumos** mostra `"até msg N"` (ambíguo) e não diferencia visualmente quando o gatilho foi auto.
  - O insert vem do servidor (edge function) → o React Query não invalida sozinho; o usuário precisa reabrir a aba/conversa para ver. Sem realtime, parece que "não foi para Resumos".
  - `full_summary` (resumo manual) usa transcrição de áudio, mas o filtro `m.text || type==='audio'…` já está ok — manter.

## Mudanças

### 1. `src/components/chat/ConversationSummaries.tsx`
- Trocar `até msg ${s.message_count}` por `${s.message_count} mensagens`.
- Mostrar bloco de período mais visível (linha dedicada com ícone): `Período: 20/05 14:32 → 20/05 15:10`.
- Manter badge `automático` para `triggered_by` começando com `auto`.
- Para resumos do modo incremental (sem `sentiment`/`atendimento`), apenas omitir esses blocos (já é o comportamento).

### 2. `src/hooks/useConversationSummaries.ts`
- Adicionar subscription `postgres_changes` em `chat_conversation_summaries` filtrando por `conversation_id`, e invalidar o query `['conv-summaries', conversationId]` em INSERT/UPDATE/DELETE. Isso faz o auto-resumo (inserido server-side) aparecer imediatamente na aba.

### 3. Migration
- `ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversation_summaries;` (se ainda não estiver).

### 4. `supabase/functions/chat-ai-assist/index.ts` (modo `incremental_summary`)
- Sem alteração de lógica de transcrição (já correto).
- Confirmar que a inserção em `chat_conversation_summaries` ocorre **mesmo quando `insert_internal_note=false`** (já ocorre — o gating só pula quando a flag do agente bloqueia). Manter.

## Critérios de aceite
- Ao resolver/encerrar uma conversa com a flag de auto-resumo ativa, um novo card aparece em **Resumos** em até ~2s sem refresh.
- O card mostra: período `início → fim`, contagem `N mensagens`, badge `automático`.
- Áudios com transcrição aparecem dentro do texto do resumo (não como "Áudio sem transcrição").
