## Corrigir processamento do evento history da UaZapi com fila persistente e nova aba de monitoramento

### Diagnóstico

O `history` ainda não está atualizando de forma confiável porque hoje existem fluxos concorrentes para histórico:

1. `uazapi-chat-webhook` trata `history/messages.set` diretamente em `processHistorySet`
2. O mesmo webhook também tenta detectar replay histórico em lotes de `messages`
3. O sistema ainda mantém o fluxo manual antigo (`SyncWhatsappTab`, `uazapi-history-import`, `whatsapp_sync_jobs`)
4. O chat em tempo real incrementa `unread_count` para qualquer `chat_messages` inbound inserida, então histórico mal classificado volta como “não lido”

Na prática, o projeto ficou com duas arquiteturas de sincronização diferentes:
- uma baseada em evento `history` do webhook
- outra baseada em sincronização manual por número

Isso gera regras diferentes de deduplicação, criação de conversa e contagem de não lidas.

### O que será feito

1. Remover da página `/configuracoes` toda a parte de sincronização manual antiga:
   - aba `Sincronizar WhatsApp`
   - aba `Histórico de Sincronização` atual
   - textos e ações ligadas ao fluxo manual por número

2. Criar uma arquitetura única para o evento `history` da UaZapi:
   - o webhook não vai mais persistir o histórico diretamente
   - ele vai gravar o lote recebido em uma fila persistente de processamento
   - um processador em background vai consumir essa fila e aplicar as regras de sincronização

3. Fazer o chat passar a refletir o histórico somente a partir dessa fila:
   - inserir apenas mensagens inexistentes
   - nunca recriar contato existente
   - nunca atualizar mensagem já existente
   - nunca marcar imagens/mídias históricas como não lidas
   - manter `unread_count = 0` para histórico
   - ignorar sempre grupos (`@g.us`)

4. Criar uma nova aba em `/configuracoes` focada apenas em monitorar o `history` da UaZapi:
   - fila/conexão de origem
   - quantidade de mensagens recebidas no lote
   - quantidade processada
   - quantidade ignorada/duplicada/grupo
   - status da sincronização
   - acesso a detalhes/logs do lote

### Implementação

#### 1) Nova fila persistente para history
Criar novas tabelas para substituir o modelo antigo de sync manual:

- `uazapi_history_sync_runs`
  - um registro por lote/evento `history`
  - queue/conexão, cliente, status, totais, timestamps, erro
- `uazapi_history_sync_items`
  - itens do lote ou agregação por chat
  - chat/telefone, quantidade recebida, quantidade inserida, quantidade duplicada, quantidade ignorada, erro
- opcionalmente `uazapi_history_sync_payloads`
  - para auditoria do payload bruto quando necessário

Essas tabelas serão o backend da nova aba de monitoramento.

#### 2) Refatorar `uazapi-chat-webhook`
O webhook passará a:
- detectar `history/messages.set/message.history`
- filtrar grupos logo na entrada
- criar um `run` da sincronização
- registrar os itens recebidos na fila
- disparar o processador em background
- parar de usar `whatsapp_sync_jobs` para eventos `history`

Também vou consolidar a lógica para que replay histórico detectado em `messages` use o mesmo pipeline da fila.

#### 3) Criar processador dedicado do history
Criar um processador único para consumir a fila e atualizar o chat com regras idempotentes:

- deduplicar por `message_id`/`external_id`
- inserir somente mensagens ausentes
- reaproveitar `chat_contacts` já existentes sem sobrescrever dados indevidos
- criar contato apenas se não existir
- criar conversa apenas quando necessário
- atualizar `last_message_at` e `last_message_text` somente quando a nova mensagem histórica for realmente mais recente que a já salva
- gravar mensagens históricas com status seguro (`delivered`/equivalente histórico), sem gerar não lidas
- não reprocessar grupos

#### 4) Blindar a UI contra falso “não lido” de history
Ajustar o fluxo do chat para não transformar mensagens históricas em novas não lidas.

Isso será feito combinando:
- marcação explícita nas mensagens vindas do history (`metadata.source = 'uazapi_history'`)
- persistência com status histórico
- ajuste no realtime do `WhatsAppDataContext` para ignorar incremento de `unread_count` quando a mensagem for de history

#### 5) Substituir a área de configuração
Atualizar `/configuracoes` para ficar com uma única aba de acompanhamento do history da UaZapi, no lugar das abas antigas.

A nova interface mostrará:
- conexão/fila
- data/hora do evento
- mensagens recebidas
- mensagens processadas
- duplicadas/ignoradas
- contatos criados
- status
- duração
- botão para abrir detalhes

Nos detalhes, exibirei os itens por chat/telefone e eventuais erros.

#### 6) Limpeza da arquitetura antiga
Remover ou descontinuar o que ficou legado para sync manual:
- `SyncWhatsappTab`
- uso de `whatsapp_sync_jobs`/`whatsapp_sync_job_logs` para history UaZapi
- ações de cancelar/reiniciar do fluxo manual nessa área
- referências textuais do tipo “Inicie uma sincronização na aba...”

Se ainda existir uso interno do import manual fora do `history`, ele será isolado para não interferir no novo pipeline.

### Regras que o novo fluxo seguirá

- Não criar contato que já existe
- Não criar mensagem que já existe
- Não atualizar mensagem que já existe
- Não colocar imagens como não lidas
- Não subir `unread_count` por histórico
- Não processar grupos
- Incluir apenas mensagens ausentes, recebidas durante o período desconectado

### Validação

1. Receber um evento `history` com mensagens já existentes e novas
2. Confirmar que:
   - somente as novas entram em `chat_messages`
   - contatos existentes não são recriados
   - `unread_count` permanece 0
   - grupos continuam ignorados
3. Confirmar que o chat atualiza a conversa corretamente com base no processamento da fila
4. Confirmar que `/configuracoes` mostra o lote processado, a fila/conexão e os totais corretos
5. Confirmar que o fluxo antigo de sincronização manual não aparece mais na tela

### Detalhes técnicos

```text
UaZapi history event
        ↓
uazapi-chat-webhook
        ↓
insert em uazapi_history_sync_runs/items
        ↓
processador background do history
        ↓
chat_contacts / chat_conversations / chat_messages
        ↓
realtime do chat atualizado sem unread indevido
```

Arquivos mais prováveis de alteração:
- `supabase/functions/uazapi-chat-webhook/index.ts`
- nova edge function de processamento da fila do history
- migrations para novas tabelas de fila/monitoramento
- `src/pages/configuracoes/ConfiguracoesPage.tsx`
- novo componente/aba de monitoramento do history UaZapi
- `src/contexts/WhatsAppDataContext.tsx`
- remoção/substituição de `SyncWhatsappTab`, `SyncHistoryTab` e hooks relacionados