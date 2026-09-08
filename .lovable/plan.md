# Corrigir leads "Em atendimento" sem responsável

## O que está acontecendo

Hoje existem **55 conversas com status "Em atendimento" e nenhum responsável** (52 do WhatsApp comum, 3 da API Oficial). Investiguei a origem de cada uma:

1. **Remoção de membro da equipe (36 conversas)** — quando um atendente é removido da equipe, o sistema limpa o responsável das conversas dele, mas **não muda o status**: elas continuam "Em atendimento" sem dono, em vez de voltar para "Aguardando atendimento".
2. **Envio pela API Oficial (3 conversas)** — quando uma mensagem sai pela API Oficial e ainda não existe atendimento aberto para aquele contato, o sistema cria o atendimento já como "Em atendimento", sem responsável. É esse caminho que explica os leads novos aparecendo assim (os 2 casos mais recentes, de 07/09, não têm nenhum histórico — foram criados direto nesse fluxo).
3. **1 conversa** foi deixada sem dono por uma reatribuição manual antiga; será corrigida no acerto dos dados.

Os outros caminhos que devolvem conversa para a fila (retorno automático, rebalanceamento, transferência em massa, limite da IA) já fazem certo: limpam o responsável **e** voltam o status para "Aguardando".

## O que vou fazer

1. **Remoção de membro**: passar as conversas do atendente removido para "Aguardando atendimento" (sem dono), mantendo o registro no histórico.
2. **API Oficial**: criar o atendimento como "Aguardando atendimento" quando não houver responsável definido.
3. **Trava definitiva no banco**: uma regra automática que, em qualquer inclusão ou alteração, converte "Em atendimento" sem responsável para "Aguardando atendimento". Assim, mesmo um caminho novo ou um ajuste manual não recria o problema.
4. **Acerto dos dados atuais**: mover as 55 conversas existentes para "Aguardando atendimento", para que voltem a aparecer na fila de espera dos atendentes.

## Detalhes técnicos

- `supabase/functions/team-member-cleanup-conversations/index.ts` (~linha 53): incluir `status: 'pending'`, `assigned_user_id: null`, `assigned_at: null` no update dos `openIds`.
- `supabase/functions/waba-send/index.ts` (~linha 142): trocar `status: "open"` por `status: "pending"` na criação da conversa em `persistOutbound`.
- Migração: trigger `BEFORE INSERT OR UPDATE` em `public.chat_conversations` (função `chat_enforce_owner_on_open`) que faz `NEW.status := 'pending'` quando `NEW.status = 'open'` e `NEW.assigned_to` é nulo/vazio. Complementa os triggers `auto_open_on_*` existentes (que fazem o inverso).
- Backfill na mesma migração: `UPDATE public.chat_conversations SET status='pending', assigned_user_id=NULL, assigned_at=NULL WHERE status='open' AND COALESCE(TRIM(assigned_to),'')=''`.
- A regra da UI (`ChatList.tsx` / `WhatsAppDataContext.tsx`) que já reclassifica `open` sem dono como `pending` continua como defesa extra — nada muda no front.
- Verificação: reconsultar a contagem de `open` sem `assigned_to` (esperado 0) e conferir que o trigger rejeita um insert `open` sem dono.
