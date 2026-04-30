Objetivo: corrigir o caso em que as mensagens estão sendo gravadas/recebidas corretamente no backend, mas não aparecem na lista de conversas nem no painel do chat para alguns usuários.

O que identifiquei

1. O backend está persistindo as mensagens.
- Para o cliente 272, encontrei mensagens novas gravadas em `chat_messages` e contatos atualizados em `chat_contacts`.
- Exemplo real: o contato “Mário Castro” recebeu/teve envios hoje, com `last_message_at` atualizado e mensagens salvas.
- O webhook de entrada também está funcionando e gravando registros.

2. A migração de contatos/conversas foi feita, mas existe um segundo problema de visibilidade.
- `chat_contacts`: 430 contatos no `channel_source` da fila ativa `04eee74a-79ca-4d0b-9b01-58b0253578e1`.
- `chat_conversations`: 435 conversas na fila ativa.
- Não sobrou nada preso na fila deletada.

3. A hipótese mais forte é perda de acesso à fila após a troca/migração da fila.
- O chat carrega contatos apenas das filas retornadas por `useAccessibleQueues()`.
- Quando o usuário tem acesso restrito (`queue_access = 'specific'`), a lista depende de `queue_members` no banco externo.
- No fluxo atual de exclusão/migração de fila, o sistema limpa `queue_members` da fila antiga, mas não move esses membros para a fila nova.
- Eu confirmei que hoje não há `queue_members` nem na fila antiga nem na nova.
- Resultado prático: para usuários restritos, `activeQueueIds` fica vazio, `loadContacts()` retorna lista vazia, `loadConversations()` também, e o realtime deixa de abastecer a UI de forma útil.

4. Existe um segundo fator que mascara o problema: filtro padrão de período.
- A lista do chat nasce com `periodFilter = 'last7days'`.
- Isso sozinho já esconderia contatos antigos como Anísio, mesmo com os dados corretos no banco.
- Então há dois efeitos combinados:
  - usuários restritos podem perder a fila inteira;
  - contatos antigos continuam ocultos pelo filtro de 7 dias.

5. Envio/recebimento “funciona no banco”, mas não “sobe” para a interface.
- O fluxo de envio grava em `chat_messages` e atualiza `chat_contacts`.
- O problema está na camada de seleção/filtragem das filas e da lista, não no armazenamento das mensagens.

Plano de correção

1. Reparar o acesso da fila para o usuário afetado
- Verificar o usuário logado que está com o problema e o `queue_access` dele.
- Se for `specific`, recriar os vínculos em `queue_members` para a fila ativa `04eee74a-79ca-4d0b-9b01-58b0253578e1`.
- Validar depois se `useAccessibleQueues()` volta a retornar a fila ativa para esse login.

2. Corrigir definitivamente a migração de permissões entre filas
- Ajustar `supabase/functions/queue-management/index.ts` para que, ao migrar/excluir/restaurar fila com destino, o sistema também mova/cop ie os membros restritos da fila antiga para a fila destino.
- Isso evita repetir o apagão de visibilidade em futuras migrações.
- Não vou abrir acesso global por fallback; vou preservar a regra de segurança por fila.

3. Melhorar a inicialização do chat quando as filas ainda estão carregando
- Ajustar `src/contexts/WhatsAppDataContext.tsx` para não limpar contatos/mensagens prematuramente enquanto `useAccessibleQueues()` ainda está resolvendo.
- Quando não houver nenhuma fila acessível de fato, mostrar estado explícito de “sem acesso a filas” em vez de parecer que não existem mensagens.
- Isso elimina o falso “chat vazio” por race condition ou permissão ausente.

4. Corrigir o filtro que esconde históricos antigos
- Ajustar `src/components/chat/ChatList.tsx` para não iniciar preso em `last7days` no chat operacional, ou tornar isso claramente visível/resetável.
- Assim, contatos antigos como Anísio voltam a aparecer depois que o acesso à fila estiver correto.

5. Validar ponta a ponta
- Testar com o login afetado:
  - lista de conversas carregando após refresh;
  - Anísio visível novamente;
  - mensagem recebida aparecendo na lista e no painel;
  - mensagem enviada aparecendo imediatamente no chat;
  - realtime funcionando sem depender de recarregar.

Detalhes técnicos

Arquivos principais a alterar
- `src/contexts/WhatsAppDataContext.tsx`
- `src/components/chat/ChatList.tsx`
- `supabase/functions/queue-management/index.ts`

Ação de dados necessária
- Reassociar usuários restritos à fila ativa no banco externo (`queue_members`), porque hoje os vínculos estão vazios.

Risco principal
- O único cuidado é não criar fallback que ignore restrição de fila e exponha conversas de outras filas. A correção será feita mantendo o controle de acesso.

Se você aprovar, eu executo esse plano em duas frentes: primeiro reparo os vínculos da fila ativa para o usuário afetado, depois aplico o endurecimento no código para o problema não voltar.