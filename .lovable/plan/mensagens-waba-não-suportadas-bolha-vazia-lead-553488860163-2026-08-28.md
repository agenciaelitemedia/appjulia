# Mensagens WABA não suportadas — bolha vazia (lead 553488860163)

## Problema confirmado nos dados

A mensagem `c7dc90e5-...` do contato `ca333992-...` (553488860163) está gravada no banco com:

- `type = 'unsupported'`, `text = null`, `from_me = false`, timestamp 13:38 UTC (10:38 BRT)
- `metadata = null` — **toda a informação útil está só em `raw_payload`**
- `raw_payload` contém `unsupported: { raw_type: "unknown", type: "unknown" }` e `errors: [{ code: 131060, error_data: { details: "This message is currently unavailable." } }]`

Ou seja: a Meta entregou um tipo que a Cloud API não suporta/resolveu, sem conteúdo. Não há o que recuperar. Não é bug de fila, webhook ou permissão.

**Correção principal (confirma):** o `MessageBubble` não trata `type: 'unsupported'` (só `revoked`), então renderiza bolha vazia só com o horário.

**Correção ao plano original:** o plano dizia mostrar `errors[0].error_data.details` como tooltip "quando o payload traz". Isso **não é possível hoje** lendo só o objeto de mensagem do frontend, porque esse detalhe vive apenas em `raw_payload` (coluna não exposta no `ChatMessage` do frontend) e `metadata` está nulo. Para o tooltip funcionar de verdade, precisamos também propagar o detalhe do erro para `metadata` no momento da persistência (mudança mínima e segura no `meta-webhook`, que enriquece mensagens já gravadas sem alterar o fluxo).

## Mudanças

### 1. Tipo no schema (`src/types/chat.ts`)
Acrescentar `'unsupported'` ao union `MessageType`.

### 2. Bolha no chat (`src/modules/julia-chat/chat/components/MessageBubble.tsx`)
Logo após o bloco `revoked` (~linha 540), adicionar tratamento para `message.type === 'unsupported'`:
- Bolha discreta em itálico com mesmo estilo do `revoked`: **"⚠️ Mensagem não suportada pelo WhatsApp Oficial — conteúdo não disponível"**
- Se `message.metadata?.unsupported_detail` existir (vindo da mudança da webhook abaixo), exibir como legenda/tooltip secundária discreta.
- Mantém horário e status normais; não afeta UaZapi nem outros tipos.

### 3. Preview na lista (`src/lib/chat/messagePreview.ts`)
No `TYPE_LABELS`, adicionar `unsupported: '⚠️ Mensagem não suportada'` — assim a última mensagem na lista não aparece em branco.

### 4. Propagar detalhe do erro (`supabase/functions/meta-webhook/index.ts`)
Em `persistMessage` (linha ~368-390), onde hoje grava `metadata: quotedMeta ? { quoted_message: quotedMeta } : null`, passar também a copiar para `metadata.unsupported_detail` o `errors[0].error_data.details` (e/ou o `unsupported` cru) quando `msgType === 'unsupported'`. Isso é apenas um enriquecimento de persistência — mesmo `raw_payload` e mesmo tipo de mensagem.

Não altera nada no fluxo de ingestão, deduplicação ou parsing; não toca em UaZapi.

## Validação
1. Abrir a conversa do 553488860163 e confirmar que a mensagem de 10:38 mostra o aviso (e o detalhe secundário, se a webhook já repersistir) em vez de bolha vazia.
2. Conferir que mensagens normais (texto, imagem, áudio, vídeo, sticker) de WABA e UaZapi seguem idênticas.
3. Verificar no build que o union `MessageType` com `'unsupported'` não quebra outros usos de switch sobre `type`.

## Observação
A mensagem já gravada (c7dc90e5) tem `metadata = null`, então o tooltip só aparecerá para mensagens `unsupported` **novas** (persistidas após a mudança da webhook) — a bolha com o aviso, porém, aparece para todas, incluindo essa, pois depende só do `type`.