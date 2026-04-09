

# Corrigir webhook do Assistente de Suporte — mensagens não sendo gravadas

## Problema

O webhook recebeu uma chamada da UaZapi mas o campo `body.event` veio como `undefined`. O filtro na linha 23 descarta qualquer payload sem esse campo, por isso nenhuma mensagem foi gravada (tabela `support_group_messages` está vazia).

A Evolution API/UaZapi pode enviar o tipo de evento em locais diferentes dependendo da versão e configuração do webhook. Possibilidades comuns:
- `body.event` (formato padrão)
- `body.data.event`
- Header `x-webhook-event`
- O payload pode ser um array de mensagens dentro de `body.data`
- O endpoint pode receber o evento sem campo `event` (apenas o payload da mensagem direto)

## Correção

Alterar `support-assistant-webhook/index.ts`:

1. **Logar o payload completo** (temporariamente) para diagnosticar o formato real
2. **Flexibilizar a detecção do evento**: aceitar payload mesmo sem campo `event`, desde que contenha dados de mensagem (`key`, `message`, `remoteJid`)
3. **Extrair `remoteJid` de múltiplos caminhos possíveis**: `body.data.key.remoteJid`, `body.key.remoteJid`, `body.data[0].key.remoteJid` (quando array)
4. **Tratar `senderJid` com LID**: como a API usa AddressingMode LID, o `participant` vem como LID. Precisamos buscar o `PhoneNumber` do participante no payload se disponível, senão usar o LID e cruzar com a tabela de team members pelo telefone

Lógica revisada:
```text
1. Logar body inteiro
2. Tentar extrair event de body.event || body.data?.event || "unknown"
3. Tentar extrair msgData de body.data (se array, pegar [0]) || body.message || body
4. Tentar extrair key e remoteJid
5. Se remoteJid contém @g.us → processar (sem depender do campo event)
6. Resto da lógica permanece igual
```

## Arquivo alterado

| Arquivo | Mudança |
|---|---|
| `support-assistant-webhook/index.ts` | Flexibilizar detecção de evento, logar payload completo, aceitar mensagens sem campo `event` |

