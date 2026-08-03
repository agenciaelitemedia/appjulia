# Ressincronização: também importar mensagens faltantes

Hoje a ressincronização só corrige datas: ela busca o histórico real na UaZapi, casa por `message_id` e ajusta `timestamp`/`created_at`. Mensagens que existem na UaZapi mas **não** existem no chat são ignoradas.

## O que será feito

### 1. Detectar e importar as faltantes
Na mesma passada do `/message/find`, tudo que vier da UaZapi e não tiver `message_id` correspondente no chat passa a ser **inserido**:

- texto, tipo (imagem, vídeo, áudio/ptt, documento, sticker, localização, contato), mídia, `from_me`, nome do remetente e data real;
- marcadas como lidas (`status: 'read'`) e com `metadata.resynced = true`, para não gerar notificação nem contador de não lidas;
- vinculadas à conversa aberta/pendente mais recente do contato (mesmo critério do backfill já existente);
- inserção idempotente por `message_id` (`onConflict` com `ignoreDuplicates`), então rodar duas vezes não duplica nada.

Mensagens de grupo que vazarem em chat individual continuam sendo descartadas, e `@lid` não é usado como telefone.

### 2. Relatório e modo simulação
A resposta passa a trazer, além de `corrected`, os campos `imported` e a lista `imported_messages` (id, data, prévia). Em `dry_run` nada é gravado — só é listado o que seria corrigido e o que seria importado.

### 3. Agregados
Após importar, os agregados já recalculados (última mensagem do contato, `last_customer_message_at`, `last_message_from_me`, `updated_at` da conversa) passam a considerar também as mensagens novas.

### 4. Botão no chat
O botão "Ressincronizar datas" no painel da conversa passa a se chamar **"Ressincronizar conversa"** e o aviso de resultado informa as duas coisas: quantas datas foram corrigidas e quantas mensagens foram trazidas. Recarrega as mensagens ao final.

## Detalhes técnicos

- Alterações em `supabase/functions/chat-resync-timestamps/index.ts`: reaproveitar os extratores (`extractText`, `extractType`, `extractMediaUrl`, `tsToIso`) do padrão de `uazapi-chat-backfill`, aumentar o `limit` padrão do `/message/find` (300, máximo 1000, com paginação por `offset` até esgotar) e inserir em lote em `chat_messages`.
- Nada de novo em banco; sem migration.
- Frontend: apenas o rótulo e o toast do botão em `src/components/chat/ContactDetailPanel.tsx`.
