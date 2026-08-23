# /mvp-chat: ordenação estável, visual das listas e paridade de regras com o /chat

## 1. Ordenação (bug confirmado)

A função SQL `mvp_chat_list_feed` ordena e pagina corretamente na CTE `page_ids`, mas a montagem final do JSON (`jsonb_agg(...) FROM page p`) **não tem `ORDER BY`** — o Postgres devolve as linhas na ordem que os joins laterais produzirem. Por isso a lista abre com conversas antigas no topo e, ao carregar mais 30, os itens se misturam.

Correção:
- Guardar a posição real da página: adicionar `row_number() OVER (ORDER BY <ordenação>) AS ord` em `page_ids` (mesma expressão já usada no `ORDER BY`).
- No `jsonb_agg` final, agregar com `ORDER BY p.ord` e remover o campo `ord` do objeto retornado (como já é feito com `rn` e os alvos de SLA).
- Acrescentar desempate determinístico (`conversation_id`) ao fim de todas as ordenações, para que páginas seguintes não repitam nem pulem linhas quando as datas empatarem.

No frontend, os patches de tempo real em `useMvpChatFeed.ts` reordenam sempre de forma decrescente. Passa a respeitar `filters.sort`: `recent` (desc), `oldest` (asc), `unread` (não lidas primeiro), `sla` (crítico primeiro) — mesma chave de data usada no servidor.

## 2. Visual das listas

Em `MvpChatRow.tsx`:
- Remover bordas superior/esquerda/direita e o arredondamento externo; manter apenas **borda inferior pontilhada** ocupando toda a largura da lista.
- Fundo suave por aba, alinhado à cor da aba: âmbar muito leve em "Aguardando", esmeralda muito leve em "Atendimento", neutro em "Encerradas" (via prop `accent`, já existente em `MvpChatList`).
- Selecionado e hover continuam destacando por fundo (sem voltar a borda).
- Espaçamento entre cards deixa de existir (a borda pontilhada faz a separação).

## 3. Paridade de regras com o /chat

- **Fila desconectada**: usar o mesmo hook de status de conexão em lote das filas acessíveis. Card de conversa de fila desconectada ganha fundo vermelho suave + faixa lateral vermelha e, ao clicar, abre aviso de fila desconectada em vez de abrir a conversa.
- **Ícones da barra de busca** (mesma ordem do /chat): Ordenar (já existe), **Agenda de retornos** (`CalendarClock`, com badge de quantas conversas adiadas), **Grupos** (`Users`) e, só para `admin`/`user`/`colaborador`, **Métricas** (`BarChart3`) e **Configurações do chat** (`Settings`). Limpar filtros permanece.
- **Regra de perfil para Grupos**: o botão só aparece se o plano do escritório permitir grupos (mesma checagem de limites de fila do /chat); sem permissão, o filtro de grupos é forçado para individuais.
- **Regra de perfil para atendimento**: mantida a já aplicada (perfis não privilegiados só veem conversas em atendimento atribuídas a eles).
- **Adiadas escondidas por padrão** (já ativo) — a agenda de retornos passa a ser a forma de vê-las.

## Detalhes técnicos

- Nova migration recriando `public.mvp_chat_list_feed` (v21) com `ord`/`jsonb_agg ORDER BY` e desempate por `conversation_id`. Sem mudança de assinatura, então a Edge Function `mvp-chat-list-feed` não muda.
- `src/modules/mvp-chat/hooks/useMvpChatFeed.ts`: comparador de ordenação derivado de `filters.sort`, aplicado nos patches de realtime.
- `src/modules/mvp-chat/components/MvpChatRow.tsx`: novas props `accent` e `disconnected`; estilos de borda/fundo.
- `src/modules/mvp-chat/components/MvpChatList.tsx`: repassa `accent`, resolve `disconnected` pelo mapa de status das filas e remove o espaçamento entre itens.
- `src/modules/mvp-chat/components/MvpChatFilters.tsx`: novos botões de ícone com gating por papel/limites; painel de conversas adiadas reaproveitado do /chat.
- `src/modules/mvp-chat/extend/`: exportar (sem editar) `useQueueConnectionStatusesBatch`, `useAgentQueueLimits` e o painel de adiadas para consumo pelo módulo.
- Nada em `src/components/chat/` ou no `/chat` é alterado.
