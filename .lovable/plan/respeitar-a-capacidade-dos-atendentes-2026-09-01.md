# Respeitar a capacidade dos atendentes

## O que está acontecendo hoje

Verificado no banco (escritório 300):

- `chat_agent_capacity` tem os tetos certos (Stherffany = 20, Charles = 20), mas a coluna `current_load` está **0 para todos** — nenhum ponto do código escreve nela. Ela nunca foi atualizada desde a criação.
- A carga real, contada nas conversas abertas: Stherffany **128** (117 + 11 gravadas com o ID `414` no lugar do nome), Charles **137**, Tell Moitas 57, Letícia 34.
- O único lugar que checa capacidade é a distribuição automática (`chat-route-conversation`), e como ela lê `current_load = 0`, todo mundo sempre parece livre.
- Todas as outras formas de atribuir conversa **não checam nada**: pegar o atendimento no chat, enviar mensagem (auto-atribui), transferir no cabeçalho, painel do ticket, transferência em lote, automações e API pública.
- `assigned_to` às vezes guarda o nome e às vezes o ID numérico, o que hoje divide a contagem do mesmo atendente em duas linhas.

## Decisões

- Atribuir acima do limite fica **bloqueado sempre** (inclusive para admin).
- O excedente atual é **devolvido para a fila** (as conversas mais antigas sem resposta recente), até cada atendente ficar dentro do teto.
- Todo membro de equipe sem registro passa a ter teto padrão **20**.

## Plano

### 1. Carga real, calculada no banco (fonte única)

- Função `chat_agent_live_load(client_id)` que conta conversas `open`/`pending` por atendente, casando por `assigned_user_id` e também por nome quando o ID é nulo, e reconhecendo o caso em que `assigned_to` guarda o ID.
- Função `chat_capacity_check(client_id, user_id)` que devolve `{ load, max_concurrent, blocked }` — é a única regra de decisão, usada pelo servidor e pela tela.
- `current_load` deixa de ser lida como verdade: passa a ser espelho atualizado por trigger em `chat_conversations` (mudança de responsável ou de status), só para exibição/histórico.
- Normalizar os registros em que `assigned_to` guarda ID numérico, gravando o nome correspondente e preenchendo `assigned_user_id`.

### 2. Teto padrão 20

- Ao abrir o chat/configurações, garantir registro em `chat_agent_capacity` para cada membro da equipe do escritório com `max_concurrent = 20` (sem sobrescrever tetos já configurados).

### 3. Bloqueio na atribuição (servidor primeiro)

Nova função compartilhada de validação chamada em **todos** os caminhos de atribuição:

- distribuição automática (`chat-route-conversation`) — passa a usar carga real e, se ninguém tem folga, a conversa fica na fila;
- transferência em lote (`chat-bulk-transfer`) — a prévia já mostra quantas cabem e recusa o excedente;
- automações (`chat-automation-engine`), fluxos e API pública (`chat-public-api`);
- atribuição manual no app (`juliaAssignConversation` e `assignConversation` do contexto do chat), incluindo o auto-atribuir ao enviar mensagem, o botão de assumir no cabeçalho e o painel do ticket.

Quando bloqueado: nada é gravado, e o usuário vê "Stherffany está com 128/20 atendimentos — encerre atendimentos antes de receber novos".

### 4. Devolver o excedente à fila (uma vez, sob comando)

Card novo em Configurações do chat → Geral, no padrão do encerramento/transferência em lote:

- prévia por atendente: carga atual, teto, quantas serão devolvidas;
- critério de escolha do excedente: conversas mais antigas por última mensagem, sem resposta do lead nas últimas horas, preservando as mais recentes/ativas;
- dupla confirmação; devolve para a fila de origem (`status = pending`, sem responsável) e registra no histórico de cada conversa com o ID do lote.

### 5. Visibilidade

- Seletor de atendente (chat e transferências): badge `carga/teto`, item desabilitado quando cheio.
- Configurações → Distribuição: barras passam a refletir a carga real.
- Painel de Operações: alerta de sobrecarga usando a carga real (hoje ele nunca dispara porque lê 0).

## Detalhes técnicos

- Migração: funções `chat_agent_live_load` / `chat_capacity_check`, trigger de espelho em `chat_conversations`, backfill de `current_load` e normalização de `assigned_to` numérico.
- Helper `supabase/functions/_shared/chat/capacity.ts` usado por todas as edge functions de atribuição; espelho no front em `src/lib/chat/capacity.ts` chamando a mesma função do banco (RPC), para a UI não duplicar regra.
- Nova edge function `chat-rebalance-overflow` (preview/commit) para o item 4.
- Hooks/UI: `useChatAgentCapacityLive`, ajuste em `ChatRoutingPage`, `TeamMemberSelect`, `BulkTransferConversationsCard` e `useCriticalAlerts`.
