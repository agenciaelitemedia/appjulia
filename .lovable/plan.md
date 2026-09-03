# Capacidade: a tela de configurações ainda mostra o número antigo (20/20)

## Causa confirmada no banco

A regra nova já está certa. A função por fila `chat_agent_load_by_queue('300')` devolve, para a Letícia (415):

| Fila | Conversas |
|---|---|
| A3 PREV (`d3d3bc2c…`) | 14 |
| outras 4 filas | 6 |

E o allowlist dela (banco legado) é `specific` com apenas duas filas, sendo A3 PREV a única com conversas → carga correta = **14**.

O que ainda mostra 20 é a **tela `/chat/configuracoes` → aba Capacidade**: ela lê a coluna espelho `chat_agent_capacity.current_load`, que hoje está gravada em 20 pelo trigger (`chat_sync_agent_load` → `chat_agent_live_load`), regra que ignora as filas que o atendente enxerga. Confirmado no banco: `current_load = 20`, `max_concurrent = 20` para 415 (mesmo padrão em Charles 121, Stherffany 112, Tell Moitas 34).

## Correção

1. **A aba Capacidade passa a exibir a carga real**
   Em `ChatRoutingPage.tsx`, trocar `c.current_load` pela carga vinda de `useChatAgentCapacity` (que já usa `fetchLiveLoadsDetailed`: apenas `open`, sem snooze, só filas visíveis). A barra de progresso e o percentual usam esse mesmo valor.

2. **Composição visível**
   Quando houver conversas atribuídas fora das filas do atendente, mostrar embaixo em texto pequeno: "6 atribuídas em filas que ele não enxerga (não contam)", usando o `outOfScope` que o hook já retorna. Sem isso o gestor não entende a diferença com o número antigo.

3. **Demais telas que leem o espelho**
   `OperacoesMonitorPage`, `useCriticalAlerts` e as cenas de TV (`useTvAggregates`) também usam `current_load`. Passam a usar a mesma carga real, para que nenhum painel mostre um número diferente do chat.

4. **Espelho ressincronizado**
   Como o espelho não conhece o allowlist (que vive no banco legado), ele deixa de ser fonte para a UI. Para não ficar enganoso, ele é ressincronizado com a regra atual (`open`, sem snooze) e permanece apenas como referência interna do roteamento automático, que já filtra por fila no servidor.

## Detalhes técnicos

- `useChatAgentCapacity` só devolve linhas quando a distribuição automática está ativa; para a aba de capacidade é preciso a carga independente disso. Extrair um hook fino (`useChatLiveLoads`) sobre `fetchLiveLoadsDetailed(clientId)` e usá-lo nas quatro telas, mantendo `useChatAgentCapacity` como está para bloqueio/badges.
- Nenhuma mudança de regra de limite: quem não tem registro ativo com `max_concurrent > 0` continua sem limite, e limites só valem com distribuição automática ligada.
- Sem alteração em `chat_agent_live_load` / `chat_capacity_check` — já estão na regra nova.
