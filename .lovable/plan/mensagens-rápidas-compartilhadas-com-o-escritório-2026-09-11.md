# Mensagens rápidas compartilhadas com o escritório

## Como está hoje
Cada mensagem rápida é gravada com o `user_id` de quem criou e todas as telas (página de gestão e o atalho dentro do chat) filtram exatamente por esse usuário. A tabela não guarda o escritório nem qualquer marca de compartilhamento, então hoje não existe forma de uma mensagem aparecer para outra pessoa da equipe.

## O que será feito

### 1. Compartilhar com o escritório
- No formulário de criar/editar, ao lado do interruptor "Ativo", entra um novo interruptor **"Compartilhar com todo o escritório"**.
- Esse interruptor aparece **somente para o dono do escritório** (papéis admin/titular). Para os demais atendentes ele não é exibido e a mensagem continua pessoal.
- Na lista de gestão, mensagens compartilhadas ganham um selo "Escritório".
- Atendentes veem as mensagens compartilhadas do escritório na lista de gestão em modo leitura (sem editar ou excluir); apenas o dono altera as compartilhadas.

### 2. Lista do chat
- O atalho de mensagens rápidas no chat passa a mostrar duas seções com títulos: **Escritório** e **Minhas mensagens**.
- A área ganha rolagem maior e visível, para percorrer todas as mensagens sem cortar a lista.
- A busca continua funcionando e filtra as duas seções ao mesmo tempo.

### 3. Isolamento por escritório
Uma mensagem compartilhada só aparece para pessoas do mesmo escritório. Mensagens já existentes continuam pessoais e intactas.

## Detalhes técnicos
- Migração em `public.quick_messages`: novas colunas `client_id text null` e `is_shared boolean not null default false`, mais índice `(client_id, is_shared)`. Registros existentes ficam `is_shared = false`.
- No insert/update (`src/hooks/useQuickMessages.ts`) grava-se o `client_id` efetivo do usuário via `resolveEffectiveClientId`; `is_shared` só é aceito quando `isOwnerUser(user)`.
- Consultas passam a usar `or(user_id.eq.<id>, and(is_shared.eq.true,client_id.eq.<clientId>))`, mantendo a ordenação por `position`.
- `src/pages/mensagens-rapidas/QuickMessagesPage.tsx`: interruptor condicionado ao dono, selo de escritório, bloqueio de editar/excluir em itens compartilhados de outro usuário.
- `src/components/chat/QuickMessagePicker.tsx` e `src/modules/julia-chat/chat/components/QuickMessagePicker.tsx`: agrupamento Escritório / Minhas mensagens e `ScrollArea` com altura fixa maior (≈ 60vh máx.) para rolagem real.
- Sem alteração no envio das mensagens: mídia, link e variáveis seguem o fluxo atual.
