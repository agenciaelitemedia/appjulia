# Total da equipe (46) diferente do chat e da capacidade

## Por que os números divergem (verificado no banco)

Letícia (id 415, escritório 300) tem hoje: **24 em atendimento (open)**, **22 aguardando (pending)**, 3 resolvidas e 32 fechadas.

Cada tela usa uma regra diferente:

| Tela | Regra usada | Resultado |
|---|---|---|
| Painel da Equipe (coluna "Chats") | `open` + `pending`, todas as filas, sem descontar adiadas nem duplicidade de contato | **46** |
| Capacidade de atendimento | só `open`, sem adiadas, **apenas filas que ela enxerga** | 24 ou menos |
| Lista de atendimentos do chat | mesma regra da capacidade, e ainda mostra **um item por contato** (conversa mais recente) | menor ainda |

As 24 conversas em atendimento estão espalhadas por 5 filas (18 numa fila e 6 nas outras 4); se a Letícia não tem acesso a alguma dessas filas, a capacidade e a lista mostram menos que 24. Nenhuma está adiada hoje.

Ou seja: o 46 do painel da equipe é o único número que soma "aguardando" e ignora filas — por isso é sempre o maior.

## Correção proposta

Alinhar a coluna de chats do Painel da Equipe à mesma regra já usada no chat e na capacidade: contar apenas conversas **em atendimento**, não adiadas e nas filas que o atendente enxerga. Com isso os três lugares passam a exibir o mesmo número.

Opcional (a confirmar): mostrar no painel um segundo valor "aguardando", para não perder a visibilidade das 22 conversas que hoje entram no total.

## Detalhes técnicos

- `src/hooks/useTeamDashboardMetrics.ts`: substituir a contagem própria de `chat_conversations` (`status in ('open','pending')`, sem filtro de fila/snooze) pelo `fetchLiveLoadsDetailed(clientId)` de `src/lib/chat/capacity.ts`, que já usa a RPC `chat_agent_load_by_queue` + allowlist de filas e devolve `load` por `agent_identifier`.
- Mapear `agent_identifier` (user_id em texto) para os membros já resolvidos no hook; manter a resolução por nome apenas para CRM e tarefas.
- Manter o realtime atual (invalidação em `chat_conversations`).
- Se a segunda métrica "aguardando" for aprovada, expor `pending` separado em `TeamUserMetrics` com contagem restrita às filas visíveis.
