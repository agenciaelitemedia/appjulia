1. Criar hook batch de status de conexão de filas
   Criar src/hooks/useQueueConnectionStatusesBatch.ts que recebe um array de Queue e retorna Map<queueId, boolean | null>. Para filas uazapi com evo_instance, invoca uazapi-instance-manager action=status. Para filas waba com waba_token e waba_number_id, considera conectada. Usa useQueries com staleTime de 60s para evitar requisições excessivas. Filas webchat/instagram retornam null (não aplicável).

2. Integrar hook no ChatList
   Em src/components/chat/ChatList.tsx, coletar os queue_id das conversas visíveis (displayConvsByContact). Usar useQueueConnectionStatusesBatch para obter o mapa de conexão. Passar a prop isQueueDisconnected para ChatContactItem quando o status da fila for false.

3. Destacar e bloquear clique via popup no ChatContactItem
   Em src/components/chat/ChatContactItem.tsx: adicionar prop isQueueDisconnected. Aplicar fundo avermelhado sutil (bg-destructive/10) quando desconectada. Substituir o onClick direto por um handler que, se desconectada, abre um AlertDialog informando que a fila está desconectada e não será possível enviar mensagens. Ao confirmar (Entendi), fechar o popup e prosseguir com o onClick original, abrindo a conversa.

4. Validar tipos e compilação
   Executar tsgo e/ou bun typecheck para garantir que as novas props e o hook estão tipados corretamente e não há regressões.