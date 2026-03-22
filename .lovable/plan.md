

# Plano consolidado: Corrigir origem CRM + encerrar chamada remota + badge SIP no header + indicador visual

## 1. Corrigir origem CRM no historico (metadata)

**Problema**: O `dialNumber` envia `metadata: { origin, whatsapp_number }` para a API, que repassa à Api4Com. Quando o CDR volta na sincronização, esses campos ficam dentro de `cdr.metadata` mas são salvos apenas como `cdrMetadata.api4com_metadata` (linha 599/683). O `HistoricoTab` lê `(meta).origin` na raiz — que não existe.

**Correção em `api4com-proxy/index.ts`**:
- Bloco MODE 1 (linha ~599): após `if (cdr.metadata) cdrMetadata.api4com_metadata = cdr.metadata;`, adicionar:
  ```
  if (cdr.metadata?.origin) cdrMetadata.origin = cdr.metadata.origin;
  if (cdr.metadata?.whatsapp_number) cdrMetadata.whatsapp_number = cdr.metadata.whatsapp_number;
  ```
- Bloco MODE 2 (linha ~683): mesma adição.

**Correção em `api4com-webhook/index.ts`** (linha ~68):
- Após construir `metadata`, extrair `origin` e `whatsapp_number` do `event.metadata`:
  ```
  if (event.metadata?.origin) metadata.origin = event.metadata.origin;
  if (event.metadata?.whatsapp_number) metadata.whatsapp_number = event.metadata.whatsapp_number;
  ```

## 2. Encerrar chamada quando remoto desliga

**Problema**: Quando o destinatário desliga, a conexão WebRTC perde mídia mas o SIP pode não receber BYE, deixando a chamada ativa no frontend.

**Correção em `useSipPhone.ts`**:
- Na função `setupSessionListeners`, dentro de `SessionState.Established`, após configurar o áudio remoto, monitorar `peerConnection.oniceconnectionstatechange`:
  - Se `iceConnectionState === 'disconnected' || 'failed'`, aguardar 3s
  - Se não recuperar (`connected`/`completed`), chamar `session.bye()` para encerrar

## 3. Badge de status SIP no Header

**Correção em `HeaderDialer.tsx`**:
- Ao lado do botão do telefone (ou substituindo o botão atual), adicionar um Badge visível:
  - SIP `registered` ou `in-call`: Badge verde com ícone Phone + "Disponível"
  - SIP `registering`/`calling`/`ringing`: Badge amarelo com "Conectando..."
  - SIP `error`: Badge vermelho com "Indisponível"
  - SIP `idle`: Badge cinza com "Offline"
- O badge fica visível no header sem precisar abrir o popover, dando feedback visual constante

**Implementação**: Renderizar o Badge fora do `Popover`, ao lado do `PopoverTrigger`, como um elemento inline no header. Usar as cores do `dotColor` já calculadas para manter consistência.

## Arquivos alterados
| Arquivo | Ação |
|---|---|
| `supabase/functions/api4com-proxy/index.ts` | Extrair origin/whatsapp_number do metadata do CDR (2 blocos) |
| `supabase/functions/api4com-webhook/index.ts` | Extrair origin/whatsapp_number do event.metadata |
| `src/pages/telefonia/hooks/useSipPhone.ts` | Detectar ICE disconnected/failed e encerrar sessão |
| `src/components/layout/HeaderDialer.tsx` | Adicionar Badge de status SIP visível no header |

