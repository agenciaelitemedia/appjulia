# Bloquear envio fora da janela de 24h da API Oficial (WhatsApp)

## Contexto verificado

A mensagem de hoje para 558486286603 (fila 08000840005, canal API Oficial) foi aceita pelo app, mas a Meta devolveu o erro 131047 — "mais de 24 horas desde a última resposta do cliente". Ela ficou marcada como falha no chat, sem explicar o motivo ao atendente.

Hoje o app não verifica essa janela em lugar nenhum: o composer envia direto e só descobre a recusa depois. Também não existe nenhuma tela no chat para enviar um modelo aprovado (a função de envio de modelo já existe no servidor, mas sem interface no chat).

## O que será feito

1. **Detectar a janela por conversa (somente API Oficial)**
   - Calcular quando foi a última mensagem recebida do cliente naquela conversa.
   - Se passaram mais de 24 horas (ou o cliente nunca respondeu), a conversa entra em "janela fechada".
   - Conversas de WhatsApp não oficial (UaZapi) continuam exatamente como estão.

2. **Travar o envio**
   - Com a janela fechada, o campo de mensagem fica desabilitado para texto, áudio, imagens, vídeos, documentos e mensagens rápidas/agendadas.
   - Anotações internas continuam permitidas (não vão para o cliente).

3. **Aviso no meio do chat**
   - Uma faixa de aviso aparece no fim da lista de mensagens, acima do campo de digitação: explica que a conversa está fora da janela de 24 horas do WhatsApp oficial e que é preciso reabrir enviando um modelo aprovado.
   - A faixa mostra desde quando a janela está fechada.

4. **Botão "Enviar modelo" com seletor**
   - No próprio aviso, um botão abre a lista de modelos aprovados da fila (API Oficial), com busca, prévia do texto e campos para preencher as variáveis do modelo.
   - Ao enviar, o modelo vai pela API Oficial, é registrado no chat como mensagem enviada e a faixa some assim que o cliente responder (janela reaberta).
   - Se a fila não tiver modelos aprovados, o aviso orienta a criar/aprovar um modelo em Modelos da API Oficial.

5. **Proteção no servidor**
   - O envio livre pela API Oficial também passa a ser recusado no servidor quando a janela está fechada, com uma mensagem clara, para casos em que a tela esteja desatualizada.
   - Quando a Meta ainda assim recusar por 131047, a mensagem falhada passa a exibir o motivo em português no balão.

## Detalhes técnicos

- Janela: novo hook (`src/hooks/useWabaWindowStatus.ts`) consultando o último `chat_messages` com `from_me = false` da conversa (`timestamp desc`), com `staleTime` curto e invalidação pelo Realtime já existente; considera fechada quando `now - último_recebido > 24h` ou não há mensagem recebida. Aplicado só quando o canal/fila resolvida é `waba`.
- UI: nova faixa `WabaWindowNotice.tsx` renderizada no rodapé da lista em `src/components/chat/ChatMessages.tsx` e `src/modules/julia-chat/chat/components/ChatMessages.tsx`; bloqueio via prop de desabilitação nos dois `ChatInput.tsx` (texto, `AudioRecorder`, anexos, `QuickMessagePicker`, `ScheduleMessageDialog`), preservando anotação interna.
- Seletor: novo `WabaTemplateSendDialog.tsx` lendo `waba_templates` (status aprovado, fila/`waba_id` correspondentes) e chamando `waba-send` com `action: send_template` (já implementado em `supabase/functions/waba-send/index.ts`), com preenchimento de variáveis por componente.
- Guarda em `waba-send`: antes dos envios livres (texto/mídia/áudio), checar último recebido da conversa e retornar erro estruturado `waba_window_closed`; `send_template` segue liberado.
- Balão de falha: em `MessageBubble.tsx` (ambos os chats), quando `status = failed` e o log/metadados indicarem 131047, mostrar "Fora da janela de 24h — reabra com um modelo aprovado".
- Sem mudança de schema; `waba_templates` já existe.

## Verificação

- Conversa API Oficial com última resposta do cliente há mais de 24h: campo travado, faixa visível, envio de modelo funcionando.
- Conversa API Oficial com resposta recente: nada muda.
- Conversa UaZapi: nada muda.
- Typecheck e build.
