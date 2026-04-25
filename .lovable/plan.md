## Objetivo
Eliminar o bloqueio "Conversa sem agente vinculado" ao criar card no CRM a partir do chat, resolvendo `cod_agent` automaticamente quando possível.

## Diagnóstico
Hoje, `CreateCrmCardSheet.tsx` recebe `codAgent` como prop direta vinda do `ChatHeader`. Em conversas omnichannel/WABA, esse valor frequentemente vem `null` porque:
- A conversa pertence a uma **fila** (não a um agente direto).
- O `ChatHeader` não consulta `queue_agent_links` para resolver o agente da fila.

Já existem hooks prontos para isso: `useQueueAgentLink(queueId)` retorna `{ hasAgent, codAgent }` a partir do queue_id, e `useMyAgents()` retorna os agentes do usuário logado.

## Mudanças

### 1. `src/components/chat/CreateCrmCardSheet.tsx`
- Adicionar prop opcional `queueId?: string | null`.
- Implementar cadeia de resolução do `cod_agent` efetivo:
  1. Se `codAgent` prop vier preenchido → usa direto.
  2. Senão, se `queueId` existir → usa `useQueueAgentLink(queueId)` e pega `codAgent` da fila.
  3. Senão → usa `useMyAgents()` e pega o primeiro `myAgents[0].cod_agent`.
- Exibir no topo do sheet um pequeno badge informativo: "Agente: #<cod_agent> (via fila)" ou "(seu agente)" ou "(conversa)".
- Se ao final dos 3 passos ainda não houver `cod_agent` → manter o bloqueio atual com mensagem mais clara: "Nenhum agente disponível na sua conta. Crie/vincule um agente para gerar cards."

### 2. Lookup do card Julia
- A consulta `juliaCard` já depende de `effectiveCodAgent`. Se `effectiveCodAgent` resolver, o lookup roda; se não, simplesmente não roda e o card é criado sem o vínculo Julia (já é o comportamento — apenas continuar permitindo).

### 3. `src/components/chat/ChatHeader.tsx`
- Passar `queueId` (já disponível via conversa selecionada) para `<CreateCrmCardSheet queueId={...} />`. Vou inspecionar o componente para confirmar a fonte exata do queueId na conversa atual.

### 4. Persistência
- Nenhuma mudança de schema. `crm_deals.cod_agent` continua obrigatório, mas agora é preenchido pelo agente resolvido.
- `chat_crm_links.cod_agent` segue o mesmo valor resolvido.

## Não muda
- Regras de vínculo (chat sempre vinculado, Julia opcional via toggle).
- Restrição de exclusão-apenas para cards vinculados.
- Auto-seleção da primeira etapa do quadro.

## Resultado esperado
Usuário no chat clica "Criar Card no CRM" mesmo em conversas de fila sem agente direto → o sistema resolve via `queue_agent_links` → card é criado normalmente. Só bloqueia se a conta inteira do usuário não tiver nenhum agente.