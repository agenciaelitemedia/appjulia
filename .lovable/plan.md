# Acelerar a tela "Meus Agentes"

## O que está acontecendo (medido agora)

A lista de agentes é carregada por uma única consulta no banco externo (`get_user_agents`). Medições reais feitas nesta investigação:

- usuário com 32 agentes: **114 segundos**
- usuário com 26 agentes: **13,6 segundos**
- usuário com 9 agentes: **4,4 segundos**
- a mesma consulta **sem o cálculo de "Leads do mês"**: **1,5 segundo**

Ou seja: o gargalo é o contador de leads do mês, calculado agente por agente (um subcálculo por agente, cada um percorrendo toda a tabela de mensagens). Confirmado também que a tabela de mensagens não tem índice por data, o que força varredura completa a cada agente.

Agravante: essa mesma consulta é usada na verificação de acesso do app inteiro (tela de bloqueio por agente inativo), então quem tem muitos agentes espera esse tempo em qualquer página.

## O que será feito

1. **Refazer o cálculo de "Leads do mês" em uma única passada**
   Em vez de um cálculo separado por agente, agrupar de uma vez só os leads do mês para todos os agentes do usuário e juntar ao resultado. Também trocar a contagem por uma verificação de existência de mensagem, que é muito mais barata.

2. **Simplificar o vínculo entre usuário e agente**
   O vínculo hoje usa uma condição "ou" (por id ou por código), que impede o banco de usar índices. Será reescrito para permitir o uso de índice.

3. **Criar índices no banco externo**
   - mensagens: índice por (sessão, data de criação)
   - sessões: índice por agente
   Entregues como script versionado em `scripts/external-db/` e aplicados no banco.

4. **Não travar a tela enquanto os números chegam**
   A lista de agentes passa a aparecer imediatamente e o contador de leads do mês entra depois (com um indicador discreto), para que a página nunca fique esperando o número.

5. **Limpeza**
   Remover a coluna duplicada `can_edit_config` que aparece duas vezes na consulta.

## Verificação

- medir novamente o tempo da consulta para os usuários de 32, 26 e 9 agentes (meta: abaixo de 2 s)
- conferir que os números de "Leads do mês" continuam iguais aos atuais para uma amostra de agentes
- checagem de tipos e build

## Detalhes técnicos

- `supabase/functions/db-query/index.ts`, action `get_user_agents`: substituir o `LEFT JOIN LATERAL` com `COUNT(DISTINCT s.id)` por CTE `agentes_do_usuario` + agregação única em `sessions`/`log_messages` usando `EXISTS` com filtro `lm.created_at >= date_trunc('month', current_date)`.
- Índices: `CREATE INDEX IF NOT EXISTS log_messages_session_created_idx ON public.log_messages (session_id, created_at);` e `CREATE INDEX IF NOT EXISTS sessions_agent_id_idx ON public.sessions (agent_id);`
- Frontend: `useMyAgents.ts` mantém a query principal; contagem de leads passa a hook próprio (`useAgentsLeadsCount`) com nova action leve `get_user_agents_leads`; `AgentCard.tsx` consome o valor opcional. `MainLayout.tsx` continua usando apenas a query leve para o gate de agente inativo.
- Nenhuma mudança nas demais actions nem no schema de dados.
