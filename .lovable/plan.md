
## Ajuste para o histórico ignorar grupos de forma definitiva

### Problema identificado
O filtro atual do histórico está incompleto. Hoje o código ignora grupos apenas quando `remoteJid.endsWith('@g.us')`, mas eventos do UaZapi podem sinalizar grupo por outros campos como:
- `isGroup`
- `wa_isGroup`
- `groupName`
- `wa_groupName`
- `wa_chatid`
- `chatId` em formatos não padronizados

Com isso, parte das mensagens de grupo passa pelo fluxo de `history`, cria contato, cria conversa e grava mensagens, mesmo com a regra pedida para ignorar grupos no carregamento de histórico.

Além disso, existe um erro de build no helper compartilhado `resolve-queue.ts` por causa do import genérico de `@supabase/supabase-js@2`, e isso precisa ser corrigido junto para liberar o deploy da correção.

## O que será ajustado

### 1. Fortalecer a detecção de grupo no histórico
Arquivo: `supabase/functions/uazapi-chat-webhook/index.ts`

Criar uma função única de detecção de grupo para reaproveitar no webhook, cobrindo:
- `remoteJid/chatId/chatid/wa_chatid` com `@g.us`
- `msg.isGroup`
- `msg.wa_isGroup`
- presença de `groupName` / `wa_groupName`

Essa função será usada:
- na criação da lista `phones` do evento `history`
- dentro de `processHistorySet`
- antes de qualquer criação de contato/conversa/mensagem

Resultado:
- grupo não entra no job
- grupo não gera log por telefone
- grupo não cria `chat_contacts`
- grupo não cria `chat_conversations`
- grupo não grava `chat_messages`

### 2. Aplicar bloqueio defensivo em mais de um ponto
Mesmo que algum payload venha malformado, o fluxo terá proteção em camadas:
- filtro no recebimento do evento `history`
- filtro no agrupamento por chat
- `continue` antes do upsert de contato
- log de skip de grupo para auditoria

Assim a regra fica resiliente mesmo se o formato do UaZapi variar.

### 3. Garantir que o job de sincronização mostre apenas conversas individuais
Arquivo: `supabase/functions/uazapi-chat-webhook/index.ts`

O job `history_sync` continuará sendo criado automaticamente, mas:
- `total_numbers` contará só chats individuais
- `numbers` terá só telefones individuais
- `whatsapp_sync_job_logs` será criado só para individuais

Assim o Histórico de Sincronização refletirá exatamente o que está sendo importado de verdade.

### 4. Corrigir o status das mensagens do histórico
Arquivo: `supabase/functions/uazapi-chat-webhook/index.ts`

Manter a regra já definida para histórico:
- `from_me = true` → `status = 'read'`
- `from_me = false` → `status = 'pending'`

Sem incremento artificial de `unread_count` durante a importação do histórico.

### 5. Corrigir o build quebrado do helper compartilhado
Arquivo: `supabase/functions/_shared/resolve-queue.ts`

Substituir o import problemático:
- hoje: `https://esm.sh/@supabase/supabase-js@2`
- ajustar para a mesma versão fixada usada no restante das funções, ou remover dependência desnecessária de import remoto genérico

Objetivo:
- eliminar o erro de certificado no build
- permitir publicar a correção do histórico

### 6. Opcional de saneamento dos dados já importados errado
Se houver contatos/mensagens de grupo já criados pelo fluxo de histórico, incluir uma limpeza segura dos registros backfilled de grupo:
- contatos com `is_group = true` criados pelo histórico
- mensagens com `metadata.backfilled = true` ligadas a esses contatos
- conversas abertas apenas por esse fluxo

Essa etapa será feita com cuidado para não afetar grupos válidos de outros módulos que possam depender de grupo em tempo real.

## Arquivos a ajustar
- `supabase/functions/uazapi-chat-webhook/index.ts`
- `supabase/functions/_shared/resolve-queue.ts`

## Resultado esperado
- Evento `history` ignora grupos sempre
- Nenhum grupo é criado como contato no histórico
- Nenhuma mensagem de grupo é importada no histórico
- O Histórico de Sincronização mostra apenas conversas individuais
- Mensagens do histórico continuam entrando como `pending/read` conforme a origem
- Build volta a compilar normalmente

## Validação
1. Disparar novo evento `history/messages.set`.
2. Confirmar que grupos do payload não aparecem no job `history_sync`.
3. Confirmar que `chat_contacts` não recebe novos registros `is_group = true` vindos do histórico.
4. Confirmar que `chat_messages` do histórico existem apenas para contatos individuais.
5. Ver no Histórico de Sincronização que `total_numbers` e logs correspondem só a conversas individuais.
6. Validar que o build das Edge Functions passa sem o erro de import/certificado.

## Detalhes técnicos
```text
history payload
   -> detectGroup(msg)
      -> true  => ignorar totalmente
      -> false => agrupar por telefone
                   -> criar job/log
                   -> processar contato/conversa/mensagens
```

A principal correção é parar de depender só de `@g.us` e reutilizar uma detecção de grupo mais robusta em todo o fluxo de histórico.
