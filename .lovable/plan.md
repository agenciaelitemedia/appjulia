Objetivo: eliminar o estado em que o usuário entra em /chat, vê loading infinito ou lista vazia de mensagens, e só consegue recuperar saindo/voltando ou trocando filtros.

Plano

1. Estabilizar o bootstrap do chat no contexto
- Ajustar `src/contexts/WhatsAppDataContext.tsx` para não limpar `selectedContactId` e `messages` durante a primeira hidratação só porque as filas acessíveis (`activeQueueIds`) terminaram de carregar.
- Separar “carregamento inicial” de “troca real de escopo” (fila, período, cliente), usando guards de prontidão para evitar reset prematuro.
- Manter a conversa selecionada enquanto ela continuar válida no escopo atual; só limpar se ela realmente sair da fila/período visível.
- Garantir que a restauração de conversa pendente ao abrir `/chat` só rode depois que contatos/filas estiverem prontos.

2. Tornar o carregamento inicial das mensagens resiliente
- Refatorar `src/components/chat/ChatMessages.tsx` para reexecutar o load inicial quando o contato estiver selecionado mas o bucket `messages[contactId]` ainda não existir após o bootstrap.
- Diferenciar claramente os estados: `isHydratingInitial`, `isLoadingMore`, `hasLoadedFirstPage`, `loadFailed`.
- Evitar que o componente fique preso em um estado “sem mensagens” ou “carregando” quando o contexto fizer refresh silencioso.
- Fazer o scroll para o fim apenas depois da primeira página realmente consolidada.

3. Corrigir a paginação/autoload de “carregar mais mensagens”
- Parar de usar `contactMessages.length` como offset da próxima página, porque essa lista já é filtrada (ex.: notas internas de outra conversa e envelopes ocultos), o que pode quebrar a paginação.
- Passar a controlar um offset bruto por contato ou um contador de mensagens carregadas sem filtro.
- Reconfigurar o `IntersectionObserver` para usar explicitamente `scrollContainerRef.current` como `root`, com ativação apenas após a primeira página estar pronta.
- Adicionar fallback manual confiável para “Carregar mais”/“Tentar novamente” quando a interseção não disparar.

4. Ajustar restauração e navegação para conversa ativa
- Revisar `src/pages/chat/ChatPage.tsx` para restaurar a conversa pendente somente quando o contexto estiver pronto.
- Endurecer a lógica para aceitar corretamente a identificação pendente vinda de outros módulos, evitando abrir `/chat` em estado inconsistente.
- Se necessário, complementar com seleção segura da primeira conversa visível apenas após a lista estar pronta (sem auto-reset posterior).

5. Validar UX e performance do fluxo completo
- Testar os cenários: primeira entrada em `/chat`, retorno à aba, troca de filtros, troca de fila e scroll até carregar histórico antigo.
- Confirmar que a lista continua rápida, com skeleton na lista e mensagens aparecendo na primeira abertura sem exigir reentrada.
- Verificar que o realtime não perde mensagens novas durante refresh silencioso.

Arquivos previstos
- `src/contexts/WhatsAppDataContext.tsx`
- `src/components/chat/ChatMessages.tsx`
- `src/pages/chat/ChatPage.tsx`
- Possivelmente um ponto de origem do deep-link do chat, se a restauração pendente estiver vindo com identificador inconsistente.

Detalhes técnicos
- Hoje existe um forte candidato à causa raiz: o efeito de reload do contexto limpa seleção e cache de mensagens quando dependências de bootstrap mudam (`currentQueueId`, `clientId`, `activeQueueIds`, `periodFilter`). Na primeira entrada, isso pode acontecer logo após as filas acessíveis terminarem de carregar.
- A paginação atual também está vulnerável porque usa o tamanho da lista já filtrada como offset do banco. Isso pode gerar páginas incorretas, autoload falhando e necessidade de sair/voltar para “destravar”.
- Há mensagens no banco; o problema aparenta ser de ciclo de vida e sincronização do frontend, não ausência de dados.

Resultado esperado
- Entrar em `/chat` e ver mensagens na primeira vez, sem precisar sair e voltar.
- “Carregar mais mensagens” funcionando de forma consistente.
- Lista e painel mais estáveis, rápidos e previsíveis mesmo com realtime e filtros ativos.