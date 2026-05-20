## Problema

1. O botão "Gerar Resumo / Novo Resumo" no painel usa o modo `full_summary` da edge `chat-ai-assist`, que:
   - Limita a **200 mensagens** (`.limit(200)`).
   - **Não carrega resumos anteriores** como contexto (esse fluxo é exclusivo do modo `incremental_summary`).
2. O modo `incremental_summary` também tem cap de **100 mensagens**.
3. Resultado: primeiro resumo trunca em 200 mensagens; resumos seguintes ignoram os anteriores.

## Mudanças

### 1. `supabase/functions/chat-ai-assist/index.ts` — remover limites e unificar contexto

**Modo `incremental_summary`:**
- Remover `.limit(100)` da query de mensagens.
- Paginar a busca em lotes de 1000 (loop `range`) ordenando ASC por `timestamp` (mais simples que reverter desc), respeitando `lastSummary.last_message_ts` quando existir.
- Manter carregamento dos até 10 resumos anteriores (já existe).
- Manter prompt com bloco `RESUMOS ANTERIORES` + `CONVERSA ATUAL`.

**Modo `full_summary`:**
- Também paginar em lotes de 1000, sem cap fixo.
- Carregar resumos anteriores (mesmo bloco do incremental) quando houver, para consistência. (Atualmente não usa.)
- Continuar respeitando `after_ts` quando fornecido.

### 2. `src/hooks/useConversationSummaries.ts` — usar modo incremental no botão manual

- Trocar a chamada de `mode: 'full_summary'` por `mode: 'incremental_summary'` em `generateSummary`, passando `client_id` e `triggered_by`.
- A edge function já persiste o resumo nesse modo → **remover o `insert` duplicado** do hook (manter apenas `invalidateQueries`).
- Para o modo manual continuar funcionando para o "primeiro resumo" (sem `after_ts`), confiar no fluxo já existente: quando não há `lastSummary`, o edge busca tudo desde o início.
- Ajustar retorno: usar `data.summary` direto (o registro já está no banco; o invalidate vai recarregar).

### 3. Sem mudanças no schema, no `TranscriptionBlock` nem em `ConversationSummaries.tsx`

A UI continua igual; só muda o caminho de geração por trás do botão.

## Validação

- Conversa com >200 mensagens: gerar primeiro resumo → conferir que cobre desde a primeira mensagem (consultar `first_message_ts` e `message_count` no card).
- Gerar segundo resumo: verificar nos logs da edge que o prompt inclui o bloco `RESUMOS ANTERIORES (contexto acumulado…)`.
- Conferir que não há resumo duplicado em `chat_conversation_summaries` após clicar "Novo Resumo".
