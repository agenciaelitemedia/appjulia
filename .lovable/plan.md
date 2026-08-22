# /mvp-chat: parar o "pisca-pisca" do spinner e o refetch em loop

## O que está acontecendo

Não é um timer/polling. É o tempo real: em `useMvpChatFeed`, o handler `onConversation` chama `scheduleRefetch()` em **todos** os casos — inclusive quando a conversa já está na lista e só foi atualizada (o `else` final também agenda). Cada UPDATE em `chat_conversations` do cliente (e o chat gera muitos: `updated_at`, contadores, última mensagem) dispara um refetch completo da primeira página 1,5 s depois, em modo `replace`.

E o refetch em `replace` seta `loading: true`, e a página troca a lista inteira pelo `MascoteLoader` + skeletons. Resultado: os dados desaparecem da tela a cada evento. Em conversas movimentadas isso é praticamente contínuo — e sim, cada ciclo é 1 request na Edge Function + 1 SQL no Supabase (o banco legado fica protegido pelo cache, exceto nas chaves vencidas).

## Correções

1. **Revalidação silenciosa**: separar "carregar" de "revalidar". O refetch em background não seta `loading`; ele usa um estado próprio (`revalidating`) e substitui as linhas só quando a resposta chega. O spinner grande com skeletons passa a aparecer apenas na primeira carga e quando os filtros mudam (aí a lista realmente muda de conteúdo). Indicador discreto de "atualizando" no header, no lugar do bloco de loading.

2. **Só agendar refetch quando faz sentido**: remover o `scheduleRefetch()` do caminho em que a conversa já está na lista e foi apenas atualizada — o patch incremental já cobre isso. Refetch fica restrito a: conversa/contato que não está na lista, `INSERT` de conversa, e mudança de campo que pode tirar/entrar no filtro ativo (status, fila, responsável, prioridade) — comparando o valor antigo com o novo e só agendando se de fato mudou.

3. **Debounce e limite de taxa**: aumentar o debounce (1,5 s → ~4 s) e aplicar um intervalo mínimo entre revalidações automáticas (~15 s). Eventos que chegam dentro da janela apenas incrementam o contador de novidades já existente, sem novo request.

4. **Pausar quando a aba está oculta**: com `document.hidden`, não revalidar; ao voltar o foco, uma única revalidação se houver eventos pendentes.

O botão "Recarregar" continua forçando `refresh: true` (bypass de cache) e nesse caso o loading visível é mantido, porque é ação explícita do usuário.

## Detalhes técnicos

- `src/modules/mvp-chat/hooks/useMvpChatFeed.ts`: novo parâmetro `silent` no `load`; estado `revalidating`; comparação de campos relevantes antes de agendar; `MIN_REVALIDATE_INTERVAL_MS` com `lastLoadAt`; guard de `document.hidden` + listener de `visibilitychange`.
- `src/modules/mvp-chat/hooks/useMvpChatRealtime.ts`: passar também `payload.old` no callback de UPDATE de conversa, para permitir a comparação (requer `REPLICA IDENTITY FULL` em `chat_conversations`; se não estiver, o hook cai no comportamento conservador de comparar contra a linha em memória).
- `src/modules/mvp-chat/pages/MvpChatPage.tsx`: renderizar skeletons apenas em `loading`, e um badge/ícone discreto quando `revalidating`.

Nada fora do módulo `mvp-chat` é alterado.
