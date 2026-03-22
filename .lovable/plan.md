

# Plano: Sincronizar ao desligar + Softphone centralizado no CRM

## 1. Não criar registros locais durante a ligação — sincronizar depois

### `DiscadorTab.tsx`
- Remover `completeCallLog.mutate(...)` do `handleCallEnded`
- Chamar `syncCallHistory.mutateAsync()` após desligar (com delay ~2-3s para CDR estar disponível)

### `PhoneCallDialog.tsx`
- Remover chamada à action `complete_call_log` do `handleCallEnded`
- Substituir por `sync_call_history` após desligar (com delay ~2-3s)

## 2. Softphone centralizado sobre popups ao ligar do CRM

### `SoftphoneWidget.tsx`
- Modo centralizado (`fixed inset-0 flex items-center justify-center`) com backdrop `bg-black/50` e `z-[9999]`
- Nova prop `centered?: boolean` para alternar entre canto e centro
- Nova prop `onCallFinished?: () => void` chamada ao encerrar chamada
- **Bloqueio de clique externo**: o backdrop deve consumir todos os cliques (`onClick={e => e.stopPropagation()}` + `pointer-events: none` no fundo, `pointer-events: auto` no card). Clicar fora do card do softphone **não fecha** nenhum popup. Apenas o botão de desligar/fechar dentro do widget encerra o softphone.
- Ao terminar a chamada (status volta para `registered`/`idle` após `in-call`): chamar `onCallFinished` e fechar automaticamente

### `PhoneCallDialog.tsx`
1. Usuário clica "Ligar" → fecha o Dialog, mostra `SoftphoneWidget` centralizado
2. `SoftphoneWidget` renderizado **fora** do Dialog (no nível raiz do componente)
3. Ao desligar → softphone fecha + dispara sincronização

## 3. Travar interação externa durante chamada ativa

- O backdrop do softphone centralizado cobre toda a tela e **não propaga eventos** para elementos abaixo
- Nenhum Dialog (Radix) aberto será fechado por clique no backdrop do softphone
- O único controle de fechamento é o botão de desligar/encerrar dentro do próprio widget
- Sem `onOpenChange` ou `onPointerDownOutside` que possa fechar popups do CRM por engano

## Arquivos alterados
- `src/pages/telefonia/components/SoftphoneWidget.tsx` — modo centralizado, bloqueio de clique externo, props novas
- `src/pages/crm/components/PhoneCallDialog.tsx` — fechar dialog ao ligar, sync ao desligar, softphone fora do dialog
- `src/pages/telefonia/components/DiscadorTab.tsx` — remover `completeCallLog`, sync ao desligar

