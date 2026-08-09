# X-Julia: frases de "Início da Sessão" reiniciam o atendimento

## Problema atual (verificado no código)
- Em `x-julia-engine/index.ts` as frases de **Início da Sessão** só são avaliadas quando ainda **não existe** sessão para a conversa (bloco `if (!existingSession)`). Se o lead já tem sessão, mandar `#start` não faz nada — a mensagem segue como turno normal.
- Não existe mensagem de confirmação de reinício (nenhuma referência a reset/restart no módulo).
- `xj_sessions` tem índice único por `conversation_id`, então "nova sessão" precisa reiniciar a linha existente (não dá para inserir uma segunda para a mesma conversa).

## O que será implementado

1. **Reinício de sessão pela frase**
   - Quando a mensagem contiver uma das frases de Início da Sessão (a comparação já ignora acentos, pontuação e caixa) e já existir sessão para a conversa, a sessão é zerada: volta ao estágio `recepcao`, `is_active = true`, `slots = {}`, dados de qualificação/handoff/pausa limpos.
   - O turno encerra aí: a Julia responde a confirmação e aguarda a próxima mensagem do lead, começando o atendimento do zero.
   - Registro em `xj_session_events` com `kind: "session_restarted"`.

2. **Mensagem de confirmação**
   - Nova configuração na aba **Ativação** do agente: "Mensagem de reinício de sessão", com texto padrão (ex.: "Prontinho! Iniciei um novo atendimento para você. Pode me contar o que precisa?").
   - Enviada pelo mesmo caminho de envio já usado pelo agente (mesma fila/canal), tanto no reinício quanto na criação da primeira sessão via frase.

3. **Restrição por campanha**
   - A frase de Início da Sessão só abre/reinicia sessão quando a entrada está restrita (flag "Apenas Campanha" ativa ou frases de campanha configuradas). Sem restrição, a frase é tratada como mensagem comum e não reinicia nada.
   - Continua valendo a regra atual: com restrição ativa, nada abre sessão a não ser frase de campanha ou frase de início (a mensagem só precisa **conter** a frase).

## Detalhes técnicos
- `supabase/functions/x-julia-engine/index.ts`: avaliar a frase de início antes do gate de sessão existente; ao casar e havendo restrição, reiniciar (update) ou criar a sessão, enviar a mensagem de reinício via `xjSend`, logar o evento e retornar sem rodar o turno do LLM.
- `supabase/functions/_shared/x-julia/activation.ts`: adicionar `restart_message` em `XJActivation` + helper com o texto padrão.
- `src/modules/x-julia/components/XJActivationTab.tsx`: novo `Textarea` para a mensagem de reinício, dentro do card "Sessão e Campanha", respeitando `canEdit`.
- Sem migração de banco: `activation` já é JSON no agente e o reinício reaproveita colunas existentes de `xj_sessions`.
- Redeploy da função `x-julia-engine`.