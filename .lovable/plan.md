# LÍDIA lendo a conversa do 5584921785354

## O que os dados mostram

Este contato tem **51 mensagens**, mas divididas em **dois atendimentos**:

- Atendimento atual (aberto em 31/08): **8 mensagens** — sendo 2 imagens sem legenda e 1 áudio do atendente **sem transcrição**.
- Atendimento anterior (04/06): **43 mensagens** — todo o histórico real do caso.

A LÍDIA hoje lê **apenas as mensagens do atendimento atualmente selecionado**. Nesse ticket sobram só 5 linhas de texto úteis ("Oi", "Boa tarde", uma pergunta e um "ok"), e a resposta do atendente foi por áudio sem transcrição. Ou seja: ela não está falhando por erro técnico, está lendo uma conversa praticamente vazia e por isso não consegue orientar nada.

## Correção

1. **Ler o histórico do contato, não só do ticket**: montar o transcript a partir de todas as mensagens do `contact_id` (todos os atendimentos), em ordem cronológica, marcando visualmente a separação entre atendimentos e destacando qual é o atendimento atual. Limitar às últimas ~400 mensagens para não estourar o prompt.
2. **Áudio sem transcrição não pode virar buraco no contexto**: quando o áudio não tiver transcrição salva, acionar a transcrição já existente no sistema (mesma rotina usada no chat) antes de montar o contexto; se ainda assim não houver, marcar explicitamente no prompt que existe um áudio do atendente não transcrito naquele ponto da conversa, para a LÍDIA pedir ao atendente o que foi dito ali.
3. **Diagnóstico útil no painel**: em vez de "Nenhuma mensagem encontrada", informar quantas mensagens/atendimentos entraram no contexto e avisar quando houver áudios sem transcrição ou imagens sem legenda — o atendente entende por que a orientação está genérica.
4. **Validar nesta conversa**: rodar a análise para o 5584921785354 e confirmar que o transcript inclui as 43 mensagens do histórico e que a LÍDIA cita fatos do caso (parcela de agosto, nome da titular, processo).

## Detalhes técnicos

- `supabase/functions/lidia-copilot/index.ts`, `loadContext`: trocar o filtro `eq("conversation_id", conversationId)` por `eq("contact_id", conv.contact_id)` com paginação, ordenando por `timestamp`, e anotar cada bloco com o `conversation_id`/protocolo de origem.
- `renderMessageForTranscript`: manter o comportamento atual e apenas enriquecer o marcador de áudio sem transcrição; acionar a função de transcrição existente antes de renderizar quando `metadata.transcription` estiver ausente.
- `diagnostics`: acrescentar contagens (mensagens, atendimentos, mídias sem texto) e expor no `LidiaPanel.tsx` no mesmo banner de "Contexto parcial" já implementado.
- Nada muda no frontend do chat nem na resolução de agente/fila (já corrigida).
