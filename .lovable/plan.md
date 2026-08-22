# /mvp-chat: abas como listas independentes (não filtro)

Hoje o Status é um filtro dentro do único feed: trocar de aba refaz a mesma consulta e perde a lista anterior. A mudança transforma cada aba em uma lista própria, com estado e paginação independentes, mantidas atualizadas em segundo plano.

## Comportamento

- **Aguardando** e **Atendimento**: carregam juntas ao entrar na página, mantêm rows/scroll/paginação próprios e continuam recebendo tempo real mesmo quando a aba não está ativa. Voltar para uma aba já carregada mostra os dados na hora (sem skeleton) e dispara uma revalidação silenciosa se os dados estiverem velhos.
- **Encerradas**: só carrega na primeira ativação, assumindo os filtros ativos. Depois disso fica em cache; enquanto inativa, não revalida nem recebe patches — só marca "precisa atualizar" e revalida ao ser reaberta.
- **Filtros** (busca, período, fila, responsável, etapas, SLA, etc.) valem para as 3 listas ao mesmo tempo: ao mudar um filtro, as listas ativa + a outra "quente" são recarregadas e a de Encerradas é invalidada (recarrega quando voltar a ser aberta).
- Contadores das abas continuam vindo dos `counters` do feed (a aba ativa alimenta os badges), sem consulta extra.

## Como evitar lentidão e erros

- **Sem rajada de requests na entrada**: a aba ativa carrega imediatamente; a aba irmã ("Aguardando" quando entra em "Atendimento") carrega logo depois, com um atraso curto (~600 ms) e apenas uma vez — 2 requests na abertura, nunca 3.
- **Revalidação em background só do necessário**: mantidos o debounce (~4 s) e o intervalo mínimo (~15 s) já existentes, agora por aba. A aba inativa usa intervalo maior (~45 s) e nunca mostra loading.
- **Aba do navegador oculta**: nenhuma lista revalida; ao voltar o foco, uma única revalidação por aba pendente.
- **Tempo real com um único canal**: hoje cada instância do feed abriria o próprio canal Realtime. Passa a existir um provider único por página que assina uma vez `chat_messages`/`chat_conversations`/`chat_contacts` e distribui os eventos para as listas registradas — evita 3 assinaturas duplicadas.
- **Roteamento do evento por aba**: o patch incremental só é aplicado na lista onde a conversa existe. Se o `status` da conversa muda (ex.: passa de `pending` para `open`), a linha é removida da lista de origem e a lista de destino agenda revalidação — sem refetch das duas listas a cada evento.
- **Cancelamento correto**: cada aba mantém seu próprio contador de request (`reqId`) e limpa timers no unmount, evitando resposta atrasada sobrescrever estado novo.
- **Paginação isolada**: `loadMore` e o `IntersectionObserver` operam sobre a lista da aba ativa; o scroll de cada aba é preservado ao alternar.

## Detalhes técnicos

- `src/modules/mvp-chat/hooks/useMvpChatFeed.ts`: extrair a lógica atual para aceitar `status` fixo e as opções `enabled` (carrega/revalida) e `background` (intervalo maior, nunca seta `loading`). Sem mudança de contrato de retorno.
- Novo `src/modules/mvp-chat/hooks/useMvpChatRealtimeHub.tsx`: contexto com um único canal Supabase e registro de handlers (`subscribe(handler) => unsubscribe`). `useMvpChatRealtime` passa a consumir o hub quando dentro do provider.
- Novo `src/modules/mvp-chat/hooks/useMvpChatTabs.ts`: orquestra as 3 instâncias (pending, open, resolved_closed), controla `activeTab`, o "aquecimento" da aba irmã, a ativação tardia de Encerradas e a invalidação em mudança de filtros. Expõe `{ activeFeed, counters, tabs }`.
- `src/modules/mvp-chat/api/types.ts`: `status` sai de `MvpChatFilters` (vira parâmetro da lista); o `fetchMvpChatFeed` passa a receber `status` separado. `DEFAULT_MVP_FILTERS` mantém `period: '7d'`.
- `src/modules/mvp-chat/components/MvpChatFilters.tsx`: nada de Status (já removido); apenas deixa de mexer nesse campo.
- `src/modules/mvp-chat/pages/MvpChatPage.tsx`: envolve a coluna da lista no provider do hub, usa `useMvpChatTabs`, mantém 3 containers de lista (o inativo fica com `hidden` para preservar o scroll) e o indicador discreto de "atualizando".
- Nenhuma alteração em SQL, Edge Function, `db-query` ou em `src/components/chat/`.
