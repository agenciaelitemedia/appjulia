# Corrigir softphone desaparecendo ao ligar pelo CRM

## Diagnóstico (baseado nos logs SIP)

O problema é uma **race condition** no fluxo SIP:

1. Usuário clica "Ligar" → `sip.call()` cria INVITE outbound, status='calling'
2. `showSoftphone = true`, Dialog fecha
3. O PBX **rejeita/redireciona** o INVITE outbound rapidamente → sessão Terminated → status volta para 'registered'
4. No SoftphoneWidget, `wasInCall` era true + status agora é 'registered' → dispara `onCallFinished` → `showSoftphone = false` → **softphone some**
5. Depois o PBX faz callback (INVITE incoming para o ramal) — mas o softphone já foi fechado

Os logs confirmam: todas as chamadas são **INCOMING** (FROM números externos TO ramal 1006). O outbound SIP falha silenciosamente.

## Correção

### `PhoneCallDialog.tsx`

- **Sempre usar REST `/dialer**` para ligar (nunca `sip.call()` direto)
- Após discar via REST, mostrar softphone e aguardar callback incoming do PBX
- Manter `showSoftphone = true` para receber a chamada de volta

### `SoftphoneWidget.tsx`

- Adicionar **grace period de 15 segundos** no `onCallFinished`: ao detectar fim da chamada, aguardar 5s antes de chamar `onCallFinished`
- Se durante esse período uma nova chamada chegar (status muda para ringing/calling/in-call), cancelar o timeout e manter o widget aberto
- Adicionar botão de **fechar manual** (X) no modo centralizado para o usuário fechar quando quiser

## Arquivos alterados

- `src/pages/crm/components/PhoneCallDialog.tsx` — sempre REST dial
- `src/pages/telefonia/components/SoftphoneWidget.tsx` — grace period + botão fechar