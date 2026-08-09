# X-Julia: memória completa da conversa

## Problema

O agente só recebe as **24 últimas mensagens da conversa atual** (`loadHistory` em `supabase/functions/_shared/x-julia/prompt.ts`). Consequências:

- Conversas longas perdem o início (nome, caso, valores já combinados).
- Se o lead voltar em outra conversa/ticket, o agente começa do zero.
- Mensagens enviadas pelo **atendente humano** entram como se fossem falas do próprio agente, sem distinção — e notas internas entram como se fossem mensagens enviadas ao lead.

## O que vai mudar

1. **Histórico por contato, não só pela conversa atual**
   Buscar as mensagens do `contact_id` (todas as conversas/tickets daquele lead), em ordem cronológica, mantendo a conversa atual sempre completa.

2. **Janela de memória bem maior + resumo do que ficou fora**
   - Últimas ~150 mensagens vão íntegras para o prompt.
   - O que ficar fora da janela é condensado em um bloco "Resumo do histórico anterior" (usa os resumos já existentes em `chat_conversation_summaries` do contato; se não houver, um resumo curto gerado a partir das mensagens antigas).

3. **Identificar quem falou**
   - Lead → papel `user`.
   - Agente (X-Julia) → papel `assistant`.
   - Atendente humano (mensagem `from_me` com `sender_name` de usuário) → entra como contexto rotulado `[Atendente <nome>]`, para o agente saber o que já foi dito/prometido sem confundir com a própria fala.
   - Notas internas (`internal_note = true`) → entram como contexto interno rotulado, nunca como mensagem enviada ao lead.

4. **Áudios/mídias**: continua usando a transcrição quando existe; sem transcrição, entra como `[audio]`, `[imagem]` etc. (comportamento atual mantido).

## Detalhes técnicos

- Arquivo principal: `supabase/functions/_shared/x-julia/prompt.ts` (`loadHistory` + montagem do system prompt).
- `runner.ts` passa a chamar `loadHistory` com o `contact_id` como escopo principal e recebe também o bloco de resumo, que é anexado ao system prompt.
- Colunas usadas: `text`, `transcription`/`caption`, `type`, `from_me`, `internal_note`, `sender_name`, `created_at`, `conversation_id`, `contact_id`.
- Corte de tamanho: limite de caracteres por mensagem (ex. 1200) e limite total do histórico, para não estourar o contexto do modelo nem o custo por turno.
- Deploy das funções `x-julia-engine` e `x-julia-followup-runner` após a alteração (compartilham `_shared/x-julia`).
- Sem mudança de schema; nada do fluxo da Julia clássica é tocado.
